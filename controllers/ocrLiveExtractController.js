
// import { createCanvas } from "canvas";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// import Tesseract from "tesseract.js";
// import mysql from "mysql2/promise";

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

// // Function to render a PDF page into an image
// async function pdfPageToImage(pdfBuffer, pageIndex) {
//   const pdfDocument = await pdfjsLib.getDocument({
//     data: new Uint8Array(pdfBuffer),
//   }).promise;
//   const page = await pdfDocument.getPage(pageIndex + 1);
//   const viewport = page.getViewport({ scale: 2.0 });
//   const canvas = createCanvas(viewport.width, viewport.height);
//   const context = canvas.getContext("2d");

//   await page.render({
//     canvasContext: context,
//     viewport: viewport,
//   }).promise;

//   return canvas.toBuffer(); // Convert the rendered canvas to an image buffer
// }
// // Utility function to normalize text (removing extra spaces and converting to lowercase)
// const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase();

// // Function to match extracted text with database records
// const matchWithDiseases = async (normalizedText) => {
//   const connection = await getDbConnection();
//   let matchedDiseases = [];

//   try {
//     const [diseaseList] = await connection.execute(
//       "SELECT diagnosis_code, LOWER(description) AS description, label FROM medical_data"
//     );

//     const escapeRegex = (string) => {
//       return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape special characters
//     };

//     diseaseList.forEach(({ description, label, diagnosis_code }) => {
//       let regex;

//       if (diagnosis_code === "Regex") {
//         regex = new RegExp(description, "gi");
//       } else {
//         const escapedDescription = escapeRegex(description);
//         regex = new RegExp(`\\b${escapedDescription}\\b`, "gi");
//       }

//       const matches = [...normalizedText.matchAll(regex)];
//       if (matches.length > 0) {
//         matches.forEach((match) => {
//           matchedDiseases.push({
//             code: diagnosis_code,
//             description: match[0],
//             label,
//             index: match.index,
//           });
//         });
//       }
//     });

//     matchedDiseases.sort((a, b) => a.index - b.index);
//   } catch (error) {
//     console.error("Error fetching from database:", error);
//     throw error;
//   } finally {
//     await connection.end();
//   }

//   return matchedDiseases;
// };

// // Function to extract dates from text using provided patterns
// const extractDates = (text, datePatterns) => {
//   const dates = new Set();
//   datePatterns.forEach((pattern) => {
//     const matches = text.match(pattern);
//     if (matches) {
//       matches.forEach((date) => dates.add(date));
//     }
//   });
//   return Array.from(dates);
// };
// const datePatterns = [
//     /(?:published on|date of birth|encounter date|date|generated on|created on|updated on|dob|date reviewed|date of issue|Problem List as of)\s*[:\-—\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*(?:\d{1,2}:\d{2}\s*[APM]{2})?/gi,
//   ];
// // Main function to handle file uploads and processing
// export const fileUpload = async (req, res) => {
//   const { baseUrl, startPage, endPage} = req.body;
//   if (!baseUrl) {
//     return res.status(400).send("Please provide a base URL.");
//   }

//   // Initialize results array and set for batch processing
//   let results = [];

//   // Function to process a single page
//   const processPage = async (pageNumber) => {
//     try {
//       const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
//       const response = await fetch(imageUrl);
//       if (!response.ok) {
//         throw new Error(`Failed to fetch image. Status: ${response.status}`);
//       }

//       const imageBytes = await response.arrayBuffer();
//       const { data: { text } } = await Tesseract.recognize(imageBytes, "eng", {
//         logger: (info) => console.log(info),
//       });

//       const normalizedText = normalizeWhitespace(text);
//       const matchedDiseases = await matchWithDiseases(normalizedText);
//       const dates = extractDates(text, datePatterns);

//       return {
//         page: pageNumber,
//         img: imageUrl,
//         text: normalizedText,
//         diseases: matchedDiseases.length > 0 ? matchedDiseases : "No diseases found",
//         // dates: dates.length > 0 ? dates : "No dates found",
//       };

//     } catch (error) {
//       console.error(`Error processing page ${pageNumber}:`, error);
//       return {
//         page: pageNumber,
//         text: "Error processing page.",
//         diseases: "Error fetching diseases",
//         // dates: "Error extracting dates",
//         img: "",
//       };
//     }
//   };
//   // Function to process pages in batches
//   const processInBatches = async (pageNumbers) => {
//     for (let i = 0; i < pageNumbers.length; i += 10) {
//       const batch = pageNumbers.slice(i, i + 10);
//       const resultsForBatch = await Promise.all(batch.map(processPage));
//       results = [...results, ...resultsForBatch];
//     }
//   };
//   try {
//     const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
//     await processInBatches(pageNumbers);
//   } catch (error) {
//     console.error("Error processing pages:", error);
//   }

//   res.json(results);
// };

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
const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, ' ').trim();

// Function to match extracted text with database records
const matchWithDiseases = async (normalizedText) => {
  const connection = await getDbConnection();
  let matchedDiseases = [];

  try {
    const [diseaseList] = await connection.execute(
      "SELECT diagnosis_code, LOWER(description) AS description, label FROM medical_data"
    );

    const escapeRegex = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    diseaseList.forEach(({ description, label, diagnosis_code }) => {
      let regex;

      if (diagnosis_code === "Regex") {
        regex = new RegExp(description, "gi");
      } else {
        const escapedDescription = escapeRegex(description);
        regex = new RegExp(`\\b${escapedDescription}\\b`, "gi");
      }

      const matches = [...normalizedText.matchAll(regex)];
      if (matches.length > 0) {
        matches.forEach((match) => {
          matchedDiseases.push({
            code: diagnosis_code,
            description: match[0],
            label,
            index: match.index,
          });
        });
      }
    });

    matchedDiseases.sort((a, b) => a.index - b.index);
  } catch (error) {
    console.error("Error fetching from database:", error);
    throw error;
  } finally {
    await connection.end();
  }

  return matchedDiseases;
};

export const fileUpload = async (req, res) => {
  const { baseUrl, startPage, endPage } = req.body;
  if (!baseUrl) {
    return res.status(400).send("Please provide a base URL.");
  }

  const socketId = req.query.socketId; // Get socket ID from query params
  if (!socketId) {
    return res.status(400).send("Socket ID is required.");
  }

  // Notify the client that OCR processing has started
  io.to(socketId).emit("ocr_started", { message: "Processing started" });

  const cancelFlag = { canceled: false };
  activeJobs.set(socketId, cancelFlag);

  const processPage = async (pageNumber) => {
    // Check cancellation immediately
    if (cancelFlag.canceled) {
      console.log(`Cancellation check before processing page ${pageNumber}`);
      return; // Stop processing if canceled
    }

    try {
      const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch image. Status: ${response.status}`);
      }

      const imageBytes = await response.arrayBuffer();

      // Cancellation check right before starting Tesseract
      if (cancelFlag.canceled) {
        console.log(`Cancellation check before Tesseract on page ${pageNumber}`);
        return;
      }

      const { data: { text: ocrText } } = await Tesseract.recognize(imageBytes, "eng", {
        logger: (info) => console.log(info),
      });

      // Another cancellation check after recognition
      if (cancelFlag.canceled) {
        console.log(`Cancellation check after Tesseract on page ${pageNumber}`);
        return;
      }

      const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
      const matchedDiseases = await matchWithDiseases(normalizedText);

      const resultForPage = {
        page: pageNumber,
        img: imageUrl,
        text: normalizedText,
        diseases: matchedDiseases.length > 0 ? matchedDiseases : "No diagnosis found",
      };

      // Emit the result for the current page immediately
      io.to(socketId).emit("page_result", { page: pageNumber, result: resultForPage });

    } catch (error) {
      console.error(`Error processing page ${pageNumber}:`, error);
      io.to(socketId).emit("page_result", { page: pageNumber, error: "Error processing page." });
    }
  };

  const processInBatches = async (pageNumbers) => {
    for (let i = 0; i < pageNumbers.length; i++) {
      // Check cancellation before processing each page
      if (cancelFlag.canceled) {
        console.log(`Stopping processing at page ${pageNumbers[i]} due to cancellation.`);
        return; // Immediately exit if canceled
      }
      await processPage(pageNumbers[i]);
    }
  };

  try {
    const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    await processInBatches(pageNumbers);

    if (!cancelFlag.canceled) {
      io.to(socketId).emit("ocr_completed", { message: "Processing completed" });
    }
  } catch (error) {
    console.error("Error processing pages:", error);
    io.to(socketId).emit("ocr_error", { message: "Error processing pages." });
  } finally {
    activeJobs.delete(socketId); // Clean up the job entry
  }
};



