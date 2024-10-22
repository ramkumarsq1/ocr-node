import Tesseract from "tesseract.js";
import mysql from "mysql2/promise";
import { io } from "../app.js"; // Ensure you import your Socket.IO instance

// Store active processing jobs by socket ID
const activeJobs = new Map();

// Function to get a database connection
const getDbConnection = async () => {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
  });
};

// Utility function to normalize text
const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, " ").trim();

// Function to match extracted text with database records
const matchWithDiseases = async (normalizedText) => {
  const connection = await getDbConnection();
  let matchedDiseases = [];
  let primaryCodes = new Set();
  let secondaryCodes = new Set();
  try {
    const [diseaseList] = await connection.execute(
      "SELECT diagnosis_code, LOWER(description) AS description, label FROM medical_data"
    );

    const escapeRegex = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    for (const { description, label, diagnosis_code } of diseaseList) {
      let regex;

      if (diagnosis_code === "Regex") {
        regex = new RegExp(description, "gi");
      } else {
        const escapedDescription = escapeRegex(description);
        regex = new RegExp(`\\b${escapedDescription}\\b`, "gi");
      }

      const matches = [...normalizedText.matchAll(regex)];

      if (matches.length > 0) {
        for (const match of matches) {
          const diseaseInfo = {
            code: diagnosis_code,
            description: match[0],
            label,
            index: match.index,
          };

          matchedDiseases.push(diseaseInfo);

          // Determine if the code is primary or secondary
          const isPrimary = await isPrimaryCode(diagnosis_code, connection);
          const isSecondary = await isSecondaryCode(diagnosis_code, connection);

          if (diagnosis_code !== "Regex" && diagnosis_code !== "null") {
            if (isPrimary) {
              primaryCodes.add(diagnosis_code);
            } else if (isSecondary) {
              secondaryCodes.add(diagnosis_code);
            }
          }
        }
      }
    }

    // Step 3: Fetch combination codes based on matched primary and secondary codes
    const combinationCodes = await getCombinationCodes(
      connection,
      primaryCodes,
      matchedDiseases
    );
    matchedDiseases.push(...combinationCodes);

    // Step 4: Sort matchedDiseases based on index
    matchedDiseases.sort((a, b) => a.index - b.index);
  } catch (error) {
    console.error("Error fetching from database:", error);
    throw error;
  } finally {
    await connection.end();
  }

  return matchedDiseases;
};

const getCombinationCodes = async (
  connection,
  primaryCodes,
  matchedDiseases
) => {
  let combinationCodes = [];

  for (const primaryCode of primaryCodes) {
    const secondaryCodes = await getSecondaryCodesForPrimary(
      primaryCode,
      connection
    );

    // Check if any of these secondary codes are part of matched diseases
    for (const secondaryCode of secondaryCodes) {
      // Find the matched disease that corresponds to the secondary code
      const matchedDisease = matchedDiseases.find(
        (disease) => disease.code === secondaryCode
      );
      if (matchedDisease) {
        const comboCode = await fetchCombinationCodeFromDb(
          connection,
          primaryCode,
          secondaryCode
        );

        if (comboCode) {
          combinationCodes.push({
            code: comboCode, // Get the combo code from the database
            description: `Combination of primary code ${primaryCode} and secondary code ${secondaryCode}`,
            label: "Combination",
            index:
              matchedDisease.index !== undefined
                ? matchedDisease.index
                : Infinity, // Use the index from the matched disease
          });
        }
      }
    }
  }

  return combinationCodes;
};

// Function to determine if a code is primary based on the database
const isPrimaryCode = async (code, connection) => {
  const [primaryCodes] = await connection.execute(
    "SELECT primary_code FROM combination_codes WHERE primary_code = ?",
    [code]
  );
  // console.log(primaryCodes);
  return primaryCodes.length > 0;
};

// Function to determine if a code is secondary based on the database
const isSecondaryCode = async (code, connection) => {
  const [secondaryCodes] = await connection.execute(
    "SELECT secondary_code FROM combination_codes WHERE secondary_code = ?",
    [code]
  );
  return secondaryCodes.length > 0;
};

// Function to fetch all secondary codes for a given primary code
const getSecondaryCodesForPrimary = async (primaryCode, connection) => {
  const [results] = await connection.execute(
    "SELECT secondary_code FROM combination_codes WHERE primary_code = ?",
    [primaryCode]
  );
  return results.map((row) => row.secondary_code);
};

// Function to fetch the combination code from the database
const fetchCombinationCodeFromDb = async (
  connection,
  primaryCode,
  secondaryCode
) => {
  const [results] = await connection.execute(
    "SELECT combo_code FROM combination_codes WHERE primary_code = ? AND secondary_code = ?",
    [primaryCode, secondaryCode]
  );
  return results.length > 0 ? results[0].combo_code : null; // Return the combo code or null if not found
};
export const fileUpload = async (req, res) => {
  const { baseUrl, startPage, endPage } = req.body;
  if (!baseUrl) {
    console.log("Missing base URL");
    return res.status(400).json({ error: "Please provide a base URL." });
  }

  const socketId = req.query.socketId;
  if (!socketId) {
    console.log("Missing socket ID");
    return res.status(400).json({ error: "Socket ID is required." });
  }

  // Notify UI about the start of the OCR process
  io.to(socketId).emit("ocr_started", { message: "Processing started" });

  const cancelFlag = { canceled: false };
  activeJobs.set(socketId, cancelFlag);

  const results = []; // To store page results

  const processPage = async (pageNumber) => {
    if (cancelFlag.canceled) {
      console.log(`Canceled before processing page ${pageNumber}`);
      return;
    }

    try {
      const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${
        pageNumber - 1
      }&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
      const response = await fetch(imageUrl);

      if (!response.ok) {
        console.log(`Failed to fetch image for page ${pageNumber}`);
        throw new Error(`Failed to fetch image. Status: ${response.status}`);
      }

      const imageBytes = await response.arrayBuffer();
      const {
        data: { text: ocrText },
      } = await Tesseract.recognize(imageBytes, "eng", {
        logger: (info) => console.log(info),
      });

      const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
      const matchedDiseases = await matchWithDiseases(normalizedText);

      const resultForPage = {
        page: pageNumber,
        img: imageUrl,
        // text: normalizedText,
        diseases:
          matchedDiseases.length > 0 ? matchedDiseases : "No diagnosis found",
      };

      io.to(socketId).emit("page_result", {
        page: pageNumber,
        result: resultForPage,
      });
      results.push(resultForPage);
    } catch (error) {
      console.error(`Error processing page ${pageNumber}:`, error);
      io.to(socketId).emit("page_result", {
        page: pageNumber,
        error: "Error processing page.",
      });
      results.push({ page: pageNumber, error: "Error processing page." });
    }
  };

  const processInBatches = async (pageNumbers, batchSize = 10) => {
    for (let i = 0; i < pageNumbers.length; i += batchSize) {
      if (cancelFlag.canceled) {
        console.log(
          `Stopping processing at page ${pageNumbers[i]} due to cancellation.`
        );
        return;
      }

      const batch = pageNumbers.slice(i, i + batchSize);

      // Process each page in the batch sequentially to maintain order
      for (const page of batch) {
        await processPage(page);
      }
    }
  };
  try {
    const pageNumbers = Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i
    );
    await processInBatches(pageNumbers, 10);

    if (!cancelFlag.canceled) {
      io.to(socketId).emit("ocr_completed", {
        message: "Processing completed",
      });
    }

    // Prepare the final JSON response
    console.log("Sending final JSON response with results.");

    // Include the total number of pages in the response
    return res.json({
      message: "PDF processing completed",
      totalPages: endPage - startPage + 1, // total number of pages processed
      results, // results from processing each page
    });
  } catch (error) {
    console.error("Error during OCR processing:", error);
    return res.status(500).json({ error: "Error processing pages." });
  } finally {
    activeJobs.delete(socketId); // Clean up after the job
  }
};

// import Tesseract from "tesseract.js";
// import mysql from "mysql2/promise";

// // Track active jobs for cancellation
// const activeJobs = new Map();

// // Get a database connection
// const getDbConnection = async () => {
//   return mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port: process.env.DB_PORT,
//   });
// };

// // Normalize OCR text
// const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, " ").trim();

// // Match text with diseases from the database
// const matchWithDiseases = async (normalizedText) => {
//   const connection = await getDbConnection();
//   let matchedDiseases = [];
//   let primaryCodes = new Set();

//   try {
//     const [diseaseList] = await connection.execute(
//       "SELECT diagnosis_code, LOWER(description) AS description, label FROM medical_data"
//     );

//     const escapeRegex = (string) =>
//       string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

//     for (const { description, label, diagnosis_code } of diseaseList) {
//       const regex = new RegExp(`\\b${escapeRegex(description)}\\b`, "gi");
//       const matches = [...normalizedText.matchAll(regex)];

//       if (matches.length > 0) {
//         for (const match of matches) {
//           const diseaseInfo = {
//             code: diagnosis_code,
//             description: match[0],
//             label,
//             index: match.index,
//           };
//           matchedDiseases.push(diseaseInfo);

//           if (await isPrimaryCode(diagnosis_code, connection)) {
//             primaryCodes.add(diagnosis_code);
//           }
//         }
//       }
//     }

//     // Fetch combination codes
//     const combinationCodes = await getCombinationCodes(
//       connection,
//       primaryCodes,
//       matchedDiseases
//     );
//     matchedDiseases.push(...combinationCodes);

//     // Sort diseases by their position in the text
//     matchedDiseases.sort((a, b) => a.index - b.index);
//   } finally {
//     await connection.end();
//   }

//   return matchedDiseases;
// };

// // Determine if a code is primary
// const isPrimaryCode = async (code, connection) => {
//   const [primaryCodes] = await connection.execute(
//     "SELECT primary_code FROM combination_codes WHERE primary_code = ?",
//     [code]
//   );
//   return primaryCodes.length > 0;
// };

// // Fetch secondary codes for a primary code
// const getSecondaryCodesForPrimary = async (primaryCode, connection) => {
//   const [results] = await connection.execute(
//     "SELECT secondary_code FROM combination_codes WHERE primary_code = ?",
//     [primaryCode]
//   );
//   return results.map((row) => row.secondary_code);
// };

// // Fetch combination codes from the database
// const getCombinationCodes = async (
//   connection,
//   primaryCodes,
//   matchedDiseases
// ) => {
//   let combinationCodes = [];

//   for (const primaryCode of primaryCodes) {
//     const secondaryCodes = await getSecondaryCodesForPrimary(
//       primaryCode,
//       connection
//     );

//     for (const secondaryCode of secondaryCodes) {
//       const matchedDisease = matchedDiseases.find(
//         (d) => d.code === secondaryCode
//       );
//       if (matchedDisease) {
//         const comboCode = await fetchCombinationCodeFromDb(
//           connection,
//           primaryCode,
//           secondaryCode
//         );
//         if (comboCode) {
//           combinationCodes.push({
//             code: comboCode,
//             description: `Combination of ${primaryCode} and ${secondaryCode}`,
//             label: "Combination",
//             index: matchedDisease.index ?? Infinity,
//           });
//         }
//       }
//     }
//   }

//   return combinationCodes;
// };

// // Fetch a combination code from the database
// const fetchCombinationCodeFromDb = async (
//   connection,
//   primaryCode,
//   secondaryCode
// ) => {
//   const [results] = await connection.execute(
//     "SELECT combo_code FROM combination_codes WHERE primary_code = ? AND secondary_code = ?",
//     [primaryCode, secondaryCode]
//   );
//   return results.length > 0 ? results[0].combo_code : null;
// };

// // Process a single page
// const processPage = async (pageNumber, baseUrl, cancelFlag) => {
//   if (cancelFlag.canceled) return { page: pageNumber, error: "Canceled" };

//   try {
//     // const imageUrl = `${baseUrl}&page=${pageNumber - 1}`;
//     const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${
//       pageNumber - 1
//     }&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
//     const response = await fetch(imageUrl);

//     if (!response.ok) {
//       throw new Error(`Failed to fetch image for page ${pageNumber}`);
//     }

//     const imageBytes = await response.arrayBuffer();
//     const {
//       data: { text: ocrText },
//     } = await Tesseract.recognize(imageBytes, "eng");

//     const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
//     const matchedDiseases = await matchWithDiseases(normalizedText);

//     return {
//       page: pageNumber,
//       // img: imageUrl,
//       // text: normalizedText,
//       diseases:
//         matchedDiseases.length > 0 ? matchedDiseases : "No diagnosis found",
//     };
//   } catch (error) {
//     console.error(`Error processing page ${pageNumber}:`, error);
//     return { page: pageNumber, error: "Error processing page." };
//   }
// };

// // Controller to start file processing
// export const fileUpload = async (req, res) => {
//   const { baseUrl, startPage, endPage } = req.body;
//   if (!baseUrl || !startPage || !endPage) {
//     return res.status(400).json({ error: "Missing required parameters." });
//   }

//   const cancelFlag = { canceled: false };
//   const jobId = `${Date.now()}`;
//   activeJobs.set(jobId, cancelFlag);

//   const results = [];
//   const pageNumbers = Array.from(
//     { length: endPage - startPage + 1 },
//     (_, i) => startPage + i
//   );

//   try {
//     for (const pageNumber of pageNumbers) {
//       const result = await processPage(pageNumber, baseUrl, cancelFlag);
//       results.push(result);
//       if (cancelFlag.canceled) break;
//     }

//     activeJobs.delete(jobId);
//     return res.json({ message: "Processing completed", results });
//   } catch (error) {
//     console.error("Processing Error:", error);
//     return res.status(500).json({ error: "Failed to process pages." });
//   }
// };

// // Cancel an active job
// export const cancelJob = (req, res) => {
//   const { jobId } = req.body;
//   const job = activeJobs.get(jobId);

//   if (job) {
//     job.canceled = true;
//     return res.json({ message: `Job ${jobId} canceled successfully.` });
//   } else {
//     return res.status(404).json({ error: "Job not found." });
//   }
// };
