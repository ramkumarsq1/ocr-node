// ====DONT TOUCH WORKING CODE==========
// // import Tesseract from "tesseract.js";
// import mysql from "mysql2/promise";
// import { io } from "../app.js"; // Ensure you import your Socket.IO instance
// import Tesseract from "node-tesseract-ocr";

// // Store active processing jobs by socket ID
// const activeJobs = new Map();

// // Function to get a database connection
// const getDbConnection = async () => {
//   return mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port: process.env.DB_PORT,
//   });
// };

// // Utility function to normalize text
// const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, " ").trim();

// // Function to match extracted text with database records
// const matchWithDiseases = async (normalizedText) => {
//   const connection = await getDbConnection();
//   let matchedDiseases = [];
//   let primaryCodes = new Set();
//   let secondaryCodes = new Set();
//   try {
//     const [diseaseList] = await connection.execute(
//       "SELECT diagnosis_code, LOWER(description) AS description, label FROM medical_data"
//     );

//     const escapeRegex = (string) => {
//       return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//     };

//     for (const { description, label, diagnosis_code } of diseaseList) {
//       let regex;

//       if (diagnosis_code === "Regex") {
//         regex = new RegExp(description, "gi");
//       } else {
//         const escapedDescription = escapeRegex(description);
//         regex = new RegExp(`\\b${escapedDescription}\\b`, "gi");
//       }

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

//           // Determine if the code is primary or secondary
//           const isPrimary = await isPrimaryCode(diagnosis_code, connection);
//           const isSecondary = await isSecondaryCode(diagnosis_code, connection);

//           if (diagnosis_code !== "Regex" && diagnosis_code !== "null") {
//             if (isPrimary) {
//               primaryCodes.add(diagnosis_code);
//             } else if (isSecondary) {
//               secondaryCodes.add(diagnosis_code);
//             }
//           }
//         }
//       }
//     }

//     // Step 3: Fetch combination codes based on matched primary and secondary codes
//     const combinationCodes = await getCombinationCodes(
//       connection,
//       primaryCodes,
//       matchedDiseases
//     );
//     matchedDiseases.push(...combinationCodes);

//     // Step 4: Sort matchedDiseases based on index
//     matchedDiseases.sort((a, b) => a.index - b.index);
//   } catch (error) {
//     console.error("Error fetching from database:", error);
//     throw error;
//   } finally {
//     await connection.end();
//   }

//   return matchedDiseases;
// };

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

//     // Check if any of these secondary codes are part of matched diseases
//     for (const secondaryCode of secondaryCodes) {
//       // Find the matched disease that corresponds to the secondary code
//       const matchedDisease = matchedDiseases.find(
//         (disease) => disease.code === secondaryCode
//       );
//       if (matchedDisease) {
//         const comboCode = await fetchCombinationCodeFromDb(
//           connection,
//           primaryCode,
//           secondaryCode
//         );

//         if (comboCode) {
//           combinationCodes.push({
//             code: comboCode, // Get the combo code from the database
//             description: `Combination of primary code ${primaryCode} and secondary code ${secondaryCode}`,
//             label: "Combination",
//             index:
//               matchedDisease.index !== undefined
//                 ? matchedDisease.index
//                 : Infinity, // Use the index from the matched disease
//           });
//         }
//       }
//     }
//   }

//   return combinationCodes;
// };

// // Function to determine if a code is primary based on the database
// const isPrimaryCode = async (code, connection) => {
//   const [primaryCodes] = await connection.execute(
//     "SELECT primary_code FROM combination_codes WHERE primary_code = ?",
//     [code]
//   );
//   // console.log(primaryCodes);
//   return primaryCodes.length > 0;
// };

// // Function to determine if a code is secondary based on the database
// const isSecondaryCode = async (code, connection) => {
//   const [secondaryCodes] = await connection.execute(
//     "SELECT secondary_code FROM combination_codes WHERE secondary_code = ?",
//     [code]
//   );
//   return secondaryCodes.length > 0;
// };

// // Function to fetch all secondary codes for a given primary code
// const getSecondaryCodesForPrimary = async (primaryCode, connection) => {
//   const [results] = await connection.execute(
//     "SELECT secondary_code FROM combination_codes WHERE primary_code = ?",
//     [primaryCode]
//   );
//   return results.map((row) => row.secondary_code);
// };

// // Function to fetch the combination code from the database
// const fetchCombinationCodeFromDb = async (
//   connection,
//   primaryCode,
//   secondaryCode
// ) => {
//   const [results] = await connection.execute(
//     "SELECT combo_code FROM combination_codes WHERE primary_code = ? AND secondary_code = ?",
//     [primaryCode, secondaryCode]
//   );
//   return results.length > 0 ? results[0].combo_code : null; // Return the combo code or null if not found
// };
// // export const liveUpload = async (req, res) => {
// //     const { baseUrl, startPage, endPage } = req.query;
// //     const resultsPerBatch = 2; // Number of results to process per batch

// //     if (!baseUrl) {
// //         console.log("Missing base URL");
// //         return res.status(400).json({ error: "Please provide a base URL." });
// //     }

// //     const socketId = req.query.socketId;
// //     if (!socketId) {
// //         console.log("Missing socket ID");
// //         return res.status(400).json({ error: "Socket ID is required." });
// //     }

// //     // Notify UI about the start of the OCR process
// //     io.to(socketId).emit("ocr_started", { message: "Processing started" });

// //     const cancelFlag = { canceled: false };
// //     activeJobs.set(socketId, cancelFlag);
// //     const config = {
// //         lang: 'eng',  // Language of OCR
// //         oem: 3,       // OCR Engine mode
// //         psm: 6        // Page segmentation mode
// //     };

// //     const totalResults = []; // To store processed results
// //     let currentPage = parseInt(startPage, 10); // Start processing from this page
   
// //     const processPage = async (pageNumber) => {
// //         if (cancelFlag.canceled) {
// //             console.log(`Canceled before processing page ${pageNumber}`);
// //             return null; // Return null if canceled
// //         }

// //         try {
// //             const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
// //             const response = await fetch(imageUrl);

// //             if (!response.ok) {
// //                 console.log(`Failed to fetch image for page ${pageNumber}`);
// //                 throw new Error(`Failed to fetch image. Status: ${response.status}`);
// //             }

// //             const arrayBuffer = await response.arrayBuffer();
// //             const buffer = Buffer.from(arrayBuffer);
// //             const ocrText = await Tesseract.recognize(buffer, config);
// //             const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
// //             const matchedDiseases = await matchWithDiseases(normalizedText);

// //             return {
// //                 page: pageNumber,
// //                 img: imageUrl,
// //                 diseases: matchedDiseases.length > 0 ? matchedDiseases : "No diagnosis found",
// //             };
// //         } catch (error) {
// //             console.error(`Error processing page ${pageNumber}:`, error);
// //             return {
// //                 page: pageNumber,
// //                 img: imageUrl,
// //                 diseases: "Error during processing",
// //             };
// //         }
// //     };

// //     try {
// //         // Process the requested pages
// //         const processedResults = await Promise.all(
// //             [currentPage, currentPage + 1].map(pageNumber => processPage(pageNumber))
// //         );

// //         // Add results for the current batch to totalResults
// //         totalResults.push(...processedResults.filter(result => result !== null));

// //         // Prepare pagination for the remaining pages
// //         const paginationDetails = [];
// //         for (let page = 1; page <= Math.ceil((endPage - startPage + 1) / resultsPerBatch); page++) {
// //             const start = (page - 1) * resultsPerBatch + parseInt(startPage, 10);
// //             const end = Math.min(start + resultsPerBatch - 1, endPage);
// //             if (end >= start) {
// //                 const paginationUrl = `/live?socketId=${socketId}&baseUrl=${encodeURIComponent(baseUrl)}&startPage=${start}&endPage=${end}`;
// //                 paginationDetails.push({
// //                     page,
// //                     url: paginationUrl,
// //                 });
// //             }
// //         }

// //         // Final response with all results
// //         return res.json({
// //             message: "PDF processing completed",
// //             totalPages: Math.ceil((endPage - startPage + 1) / resultsPerBatch),
// //             results: totalResults,
// //             pagination: paginationDetails,
// //         });
        
// //     } catch (error) {
// //         console.error("Error during OCR processing:", error);
// //         return res.status(500).json({ error: "Error processing pages." });
// //     } finally {
// //         activeJobs.delete(socketId); // Clean up after the job
// //     }
// // };

// export const liveUpload = async (req, res) => {
//   const { baseUrl, startPage, endPage } = req.query;

//   if (!baseUrl) {
//       console.log("Missing base URL");
//       return res.status(400).json({ error: "Please provide a base URL." });
//   }

//   const socketId = req.query.socketId;
//   if (!socketId) {
//       console.log("Missing socket ID");
//       return res.status(400).json({ error: "Socket ID is required." });
//   }

//   // Notify UI about the start of the OCR process
//   io.to(socketId).emit("ocr_started", { message: "Processing started" });

//   const config = {
//       lang: 'eng',
//       oem: 3,
//       psm: 6
//   };

//   const totalPages = parseInt(endPage); // Total number of pages from the query
//   const resultsPerPage = 2; // Number of pages processed per request
//   const totalResults = []; // To store processed results

//   // Function to process a single page
//   const processPage = async (pageNumber) => {
//       try {
//           const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
//           const response = await fetch(imageUrl);

//           if (!response.ok) {
//               console.log(`Failed to fetch image for page ${pageNumber}`);
//               throw new Error(`Failed to fetch image. Status: ${response.status}`);
//           }

//           const arrayBuffer = await response.arrayBuffer();
//           const buffer = Buffer.from(arrayBuffer);
//           const ocrText = await Tesseract.recognize(buffer, config);
//           const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
//           const matchedDiseases = await matchWithDiseases(normalizedText);

//           return {
//               page: pageNumber,
//               img: imageUrl,
//               diseases: matchedDiseases.length > 0 ? matchedDiseases : "No diagnosis found",
//           };
//       } catch (error) {
//           console.error(`Error processing page ${pageNumber}:`, error);
//           return {
//               page: pageNumber,
//               img: imageUrl,
//               diseases: "Error during processing",
//           };
//       }
//   };

//   try {
//       // Process the requested pages
//       const requestedPages = Array.from({ length: resultsPerPage }, (_, i) => parseInt(startPage) + i);
//       const processedResults = await Promise.all(requestedPages.map(pageNumber => processPage(pageNumber)));

//       // Filter results to only include those within the total pages range
//       const validResults = processedResults.filter(result => result.page <= totalPages);
//       totalResults.push(...validResults);

//       // Prepare pagination for remaining pages
//       const paginationDetails = [];
//       for (let page = 1; page <= Math.ceil(totalPages / resultsPerPage); page++) {
//           const start = (page - 1) * resultsPerPage + 1; // Calculate start page
//           const end = Math.min(start + resultsPerPage - 1, totalPages); // Calculate end page
//           const paginationUrl = `/live?socketId=${socketId}&baseUrl=${encodeURIComponent(baseUrl)}&startPage=${start}&endPage=${end}`;
//           paginationDetails.push({
//               page: page,
//               url: paginationUrl,
//           });
//       }

//       // Final response with results for the processed pages
//       return res.json({
//           message: "PDF processing completed",
//           totalPages: totalPages,
//           results: totalResults, // Include the results from the first request
//           pagination: paginationDetails, // All pagination links
//       });

//   } catch (error) {
//       console.error("Error during OCR processing:", error);
//       return res.status(500).json({ error: "Error processing pages." });
//   }
// };

// ====DONT TOUCH ABOVE WORKING CODE==========
// import Tesseract from "tesseract.js";
import mysql from "mysql2/promise";
import { io } from "../app.js"; // Ensure you import your Socket.IO instance
import Tesseract from "node-tesseract-ocr";
import pLimit from 'p-limit'; 
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

// export const liveUpload = async (req, res) => {
//   const { baseUrl, startPage, endPage, socketId } = req.query;
//   if (!baseUrl || !socketId) {
//     return res.status(400).json({ error: "Missing base URL or socket ID." });
//   }

//   // Notify UI about the start of the OCR process
//   io.to(socketId).emit("ocr_started", { message: "Processing started" });

//   const config = { lang: 'eng', oem: 3, psm: 6 };
//   const resultsPerPage = 5;
//   const totalPages = parseInt(endPage);

//   // Function to process a single page concurrently
//   const processPage = async (pageNumber) => {
//     const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
//     try {
//       const response = await fetch(imageUrl);
//       if (!response.ok) throw new Error(`Failed to fetch image. Status: ${response.status}`);

//       const arrayBuffer = await response.arrayBuffer();
//       const buffer = Buffer.from(arrayBuffer);
//       const ocrText = await Tesseract.recognize(buffer, config);
//       const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
//       const matchedDiseases = await matchWithDiseases(normalizedText);

//       return {
//         page: pageNumber,
//         img: imageUrl,
//         diseases: matchedDiseases.length > 0 ? matchedDiseases : "No diagnosis found",
//       };
//     } catch (error) {
//       return {
//         page: pageNumber,
//         img: imageUrl,
//         diseases: "Error during processing",
//       };
//     }
//   };

//   try {
//     // Process requested pages concurrently
//     const requestedPages = Array.from({ length: resultsPerPage }, (_, i) => parseInt(startPage) + i);
//     const processedResults = await Promise.all(requestedPages.map(processPage));

//     // Prepare pagination
//     const paginationDetails = [];
//     for (let page = 1; page <= Math.ceil(totalPages / resultsPerPage); page++) {
//       const start = (page - 1) * resultsPerPage + 1;
//       const end = Math.min(start + resultsPerPage - 1, totalPages);
//       const paginationUrl = `/live?socketId=${socketId}&baseUrl=${encodeURIComponent(baseUrl)}&startPage=${start}&endPage=${end}`;
//       paginationDetails.push({ page, url: paginationUrl });
//     }

//     return res.json({
//       message: "PDF processing completed",
//       totalPages,
//       results: processedResults.filter((result) => result.page <= totalPages),
//       pagination: paginationDetails,
//     });
//   } catch (error) {
//     console.error("Error during OCR processing:", error);
//     return res.status(500).json({ error: "Error processing pages." });
//   }
// };

export const liveUpload = async (req, res) => {
  const { baseUrl, startPage, endPage, socketId } = req.query;
  if (!baseUrl || !socketId) {
    return res.status(400).json({ error: "Missing base URL or socket ID." });
  }

  // Notify UI about the start of the OCR process
  io.to(socketId).emit("ocr_started", { message: "Processing started" });

  const config = { lang: 'eng', oem: 1, psm: 4 }; // Adjusted for faster processing
  const resultsPerPage =5;
  const totalPages = parseInt(endPage);
  const limit = pLimit(5); // Limit concurrent processing to 5 pages at a time

  // Function to process a single page concurrently
  const processPage = async (pageNumber) => {
    const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Failed to fetch image. Status: ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ocrText = await Tesseract.recognize(buffer, config);
      const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
      const matchedDiseases = await matchWithDiseases(normalizedText);

      return {
        page: pageNumber,
        img: imageUrl,
        diseases: matchedDiseases.length > 0 ? matchedDiseases : "No diagnosis found",
      };
    } catch (error) {
      return {
        page: pageNumber,
        img: imageUrl,
        diseases: "Error during processing",
      };
    }
  };

  try {
    // Process requested pages concurrently with limits
    const requestedPages = Array.from({ length: resultsPerPage }, (_, i) => parseInt(startPage) + i);
    const processedResults = await Promise.all(requestedPages.map(pageNumber => limit(() => processPage(pageNumber))));

    // Prepare pagination
    const paginationDetails = [];
    for (let page = 1; page <= Math.ceil(totalPages / resultsPerPage); page++) {
      const start = (page - 1) * resultsPerPage + 1;
      const end = Math.min(start + resultsPerPage - 1, totalPages);
      const paginationUrl = `/live?socketId=${socketId}&baseUrl=${encodeURIComponent(baseUrl)}&startPage=${start}&endPage=${end}`;
      paginationDetails.push({ page, url: paginationUrl });
    }

    return res.json({
      message: "PDF processing completed",
      totalPages,
      results: processedResults.filter((result) => result.page <= totalPages),
      pagination: paginationDetails,
    });
  } catch (error) {
    console.error("Error during OCR processing:", error);
    return res.status(500).json({ error: "Error processing pages." });
  }
};

