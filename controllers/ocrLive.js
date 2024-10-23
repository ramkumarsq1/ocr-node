// import Tesseract from "tesseract.js";
import mysql from "mysql2/promise";
import { io } from "../app.js"; // Ensure you import your Socket.IO instance
import Tesseract from "node-tesseract-ocr";

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
export const liveUpload = async (req, res) => {
    
    const { baseUrl, startPage, endPage } = req.body;
    const resultsPerPage = 2; // Number of results to process per batch

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
    const config = {
        lang: 'eng',  // Language of OCR
        oem: 3,       // OCR Engine mode
        psm: 6        // Page segmentation mode
    };
    const results = []; // To store processed page results

    const processPage = async (pageNumber) => {
        if (cancelFlag.canceled) {
            console.log(`Canceled before processing page ${pageNumber}`);
            return;
        }

        try {
            const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
            const response = await fetch(imageUrl);

            if (!response.ok) {
                console.log(`Failed to fetch image for page ${pageNumber}`);
                throw new Error(`Failed to fetch image. Status: ${response.status}`);
            }

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
            console.error(`Error processing page ${pageNumber}:`, error);
            return {
                page: pageNumber,
                img: imageUrl,
                diseases: "Error during processing",
            };
        }
    };

    try {
        // Process the first batch of pages
        const pageNumbersToProcess = [];
        for (let i = startPage; i < startPage + resultsPerPage && i <= endPage; i++) {
            pageNumbersToProcess.push(i);
        }
        
        const processedResults = await Promise.all(pageNumbersToProcess.map(pageNumber => processPage(pageNumber)));

        // Add processed results to the results array
        results.push(...processedResults);

        // Prepare pagination details for all pages
        const paginationDetails = [];
        for (let i = startPage; i <= endPage; i += resultsPerPage) {
            const pageStart = i; // Start page for the pagination link
            const pageEnd = Math.min(i + resultsPerPage - 1, endPage); // End page for the pagination link
            const paginationUrl = `/pagination?baseUrl=${baseUrl}&startPage=${pageStart}&endPage=${pageEnd}`;

            paginationDetails.push({
                page: Math.ceil(pageStart / resultsPerPage), // Page number for pagination
                url: paginationUrl, // URL for fetching the specific range of pages
            });
        }

        return res.json({
            message: "PDF processing completed",
            totalPages: Math.ceil((endPage - startPage + 1) / resultsPerPage), // Total pages calculated based on batches
            results: results, // Include results for the processed pages
            pagination: paginationDetails, // Include pagination URLs for all batches
        });
    } catch (error) {
        console.error("Error during OCR processing:", error);
        return res.status(500).json({ error: "Error processing pages." });
    } finally {
        activeJobs.delete(socketId); // Clean up after the job
    }
};





// export const getPaginationResults = async (req, res) => {
//     const { baseUrl, startPage, endPage, socketId } = req.query;

//     if (!baseUrl || !startPage || !endPage) {
//         console.log("Missing required parameters");
//         return res.status(400).json({ error: "Please provide baseUrl, startPage, and endPage." });
//     }

//     const resultsPerPage = 2; // Adjust as needed
//     const config = {
//         lang: 'eng',  // Language of OCR
//         oem: 3,       // OCR Engine mode
//         psm: 6        // Page segmentation mode
//     };
//     const results = []; // To store processed page results

//     const processPage = async (pageNumber) => {
//         try {
//             const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
//             const response = await fetch(imageUrl);

//             if (!response.ok) {
//                 console.log(`Failed to fetch image for page ${pageNumber}`);
//                 throw new Error(`Failed to fetch image. Status: ${response.status}`);
//             }

//             const arrayBuffer = await response.arrayBuffer();
//             const buffer = Buffer.from(arrayBuffer);
//             const ocrText = await Tesseract.recognize(buffer, config);
//             const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
//             const matchedDiseases = await matchWithDiseases(normalizedText);

//             return {
//                 page: pageNumber,
//                 img: imageUrl,
//                 diseases: matchedDiseases.length > 0 ? matchedDiseases : "No diagnosis found",
//             };
//         } catch (error) {
//             console.error(`Error processing page ${pageNumber}:`, error);
//             return {
//                 page: pageNumber,
//                 img: imageUrl,
//                 diseases: "Error during processing",
//             };
//         }
//     };

//     try {
//         const pageNumbersToProcess = [];
//         for (let i = startPage; i < startPage + resultsPerPage && i <= endPage; i++) {
//             pageNumbersToProcess.push(i);
//         }

//         const processedResults = await Promise.all(pageNumbersToProcess.map(pageNumber => processPage(pageNumber)));

//         results.push(...processedResults);

//         // Prepare pagination details for all pages
//         const paginationDetails = [];
//         for (let i = startPage; i <= endPage; i += resultsPerPage) {
//             const pageStart = i; // Start page for the pagination link
//             const pageEnd = Math.min(i + resultsPerPage - 1, endPage); // End page for the pagination link
//             const paginationUrl = `/pagination?baseUrl=${baseUrl}&startPage=${pageStart}&endPage=${pageEnd}`;

//             paginationDetails.push({
//                 page: Math.ceil(pageStart / resultsPerPage), // Page number for pagination
//                 url: paginationUrl, // URL for fetching the specific range of pages
//             });
//         }

//         return res.json({
//             message: "PDF processing completed",
//             totalPages: Math.ceil((endPage - startPage + 1) / resultsPerPage), // Total pages calculated based on batches
//             results: results, // Include results for the processed pages
//             pagination: paginationDetails, // Include pagination URLs for all batches
//         });
//     } catch (error) {
//         console.error("Error during pagination processing:", error);
//         return res.status(500).json({ error: "Error processing pages." });
//     }
// };

export const getPaginationResults = async (req, res) => {
    const { baseUrl, startPage, endPage } = req.query;

    // Validate parameters
    if (!baseUrl || !startPage || !endPage) {
        console.log("Missing required parameters");
        return res.status(400).json({ error: "Please provide baseUrl, startPage, and endPage." });
    }

    const config = {
        lang: 'eng',  // Language of OCR
        oem: 3,       // OCR Engine mode
        psm: 6        // Page segmentation mode
    };
    const results = []; // To store processed page results

    // Function to process each page
    const processPage = async (pageNumber) => {
        const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
        console.log(`Fetching image from: ${imageUrl}`); // Log the URL being fetched
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                console.error(`Failed to fetch image for page ${pageNumber}, Status: ${response.status}`);
                throw new Error(`Failed to fetch image. Status: ${response.status}`);
            }
    
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
            console.error(`Error processing page ${pageNumber}:`, error);
            return {
                page: pageNumber,
                img: imageUrl || "Image not available", // Ensure imageUrl is defined
                diseases: "Error during processing",
            };
        }
    };

    try {
        const processedResults = [];
        // Process each page from startPage to endPage
        for (let pageNumber = parseInt(startPage); pageNumber <= parseInt(endPage); pageNumber++) {
            const result = await processPage(pageNumber);
            processedResults.push(result);
        }

        return res.json({
            message: "PDF processing completed",
            totalPages: endPage - startPage + 1, // Total pages calculated
            results: processedResults, // Include results for the processed pages
        });
    } catch (error) {
        console.error("Error during processing:", error);
        return res.status(500).json({ error: "Error processing pages." });
    }
};
