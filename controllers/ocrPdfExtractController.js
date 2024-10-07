// import fetch from 'node-fetch'; // Ensure you're using the right package
// import Tesseract from 'tesseract.js'; // Ensure Tesseract.js is installed
// import sharp from 'sharp';

// import { diseaseList, extractDates } from '../app.js';

// // generate OCR from live files
// export const generateOCRfromlivefiles = async (req, res, next) => {
//   const { baseUrl, startPage, endPage } = req.body;

//   if (!baseUrl) {
//     return res.status(400).json({ error: 'Please provide a base URL.' });
//   }

//   const results = [];

//   // Optimize image processing by preprocessing
// const preprocessImage = async (imageBuffer) => {
//     try {
//       // Convert image to grayscale, resize, and optimize
//       const processedBuffer = await sharp(imageBuffer)
//         // .resize({ width: 1200 }) // Resize to width of 1200px; adjust as needed
//         .grayscale() // Convert to grayscale
//         .toBuffer(); // Convert processed image to buffer
//       return processedBuffer;
//     } catch (error) {
//       console.error('Error preprocessing image:', error);
//       throw error;
//     }
//   };

//   const processPage = async (pageNumber) => {
//     try {
//       const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
//       const response = await fetch(imageUrl);
//       if (!response.ok) {
//         throw new Error(`Failed to fetch image. Status: ${response.status}`);
//       }

//       // Use `response.arrayBuffer()` instead of `response.buffer()`
//       const imageBuffer = await response.arrayBuffer();

//       const preprocessedBuffer = await preprocessImage(Buffer.from(imageBuffer));

//       const { data: { text } } = await Tesseract.recognize(Buffer.from(preprocessedBuffer), 'eng', {
//         logger: (info) => console.log(info),
//       });

//       const matchedDiseases = Object.entries(diseaseList)
//         .map(([code, { descriptions, labels }]) => {
//           const exactMatch = descriptions.find(
//             (description) =>
//               text.toLowerCase().includes(description) &&
//               new RegExp(`\\b${description}\\b`).test(text.toLowerCase())
//           );
//           return exactMatch
//             ? { code, description: exactMatch, labels }
//             : null;
//         })
//         .filter(Boolean);

//       const dates = extractDates(text);

//       return {
//         page: pageNumber,
//         img: imageUrl,
//         text,
//         diseases: matchedDiseases.length > 0 ? matchedDiseases : 'No diseases found',
//         dates: dates.length > 0 ? dates : 'No dates found',
//       };

//     } catch (error) {
//       console.error(`Error processing page ${pageNumber}:`, error);
//       return {
//         page: pageNumber,
//         text: 'Error processing page.',
//         diseases: 'Error fetching diseases',
//         dates: 'Error extracting dates',
//         img: '',
//       };
//     }
//   };

//   try {
//     const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
//     for (let i = 0; i < pageNumbers.length; i += 2) {
//       const batch = pageNumbers.slice(i, i + 2);
//       const resultsForBatch = await Promise.all(batch.map(processPage));
//       results.push(...resultsForBatch);
//     }
//     res.json(results);
//   } catch (error) {
//     console.error('Error processing pages:', error);
//     res.status(500).json({ error: 'Error processing pages.' });
//   }
// };

// ==================== Working perfectly

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
// export const pdfUpload = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).send("No file uploaded.");
//   }

//   const pdfBytes = req.file.buffer;
//   const pdfDocument = await pdfjsLib.getDocument({
//     data: new Uint8Array(pdfBytes),
//   }).promise;
//   const numPages = pdfDocument.numPages;

//   const results = [];

//   // Iterate through all pages (starting from 0 to include the first page)
//   for (let i = 0; i < numPages; i++) {
//     const imageBuffer = await pdfPageToImage(pdfBytes, i);

//     // Log extracted image to buffer confirmation
//     console.log(`Image buffer extracted for page ${i + 1}`);

//     const {
//       data: { text: ocrText },
//     } = await Tesseract.recognize(imageBuffer, "eng", {
//       logger: (info) => console.log(info),
//     });

//     // Log the OCR text for debugging
//     console.log(`Extracted text from page ${i + 1}:`, ocrText);

//     let resultForPage = {
//       page: i + 1, // Page numbers start from 1 for readability
//       extractedOrder: [], // To store DOS Start, Diagnoses, and DOS End in order
//     };
//     const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, ' ').trim();
//     // Normalize input text
//     const normalizedText = normalizeWhitespace(ocrText.toLowerCase());
//     console.log(normalizedText + "testing text")
//     // const normalizedText = ocrText.toLowerCase();
   


//     // Log normalized text for debugging
//     console.log(`Normalized text for page ${i + 1}:`, normalizedText);

//     // Match diseases with extracted text after cleaning and lowercasing
//     const matchedDiseases = await matchWithDiseases(normalizedText);

//     // Log matched diseases (or lack thereof) for debugging
//     if (matchedDiseases.length > 0) {
//       console.log(`Matched diseases found for page ${i + 1}:`, matchedDiseases);
//       resultForPage.extractedOrder.push({
//         value: matchedDiseases,
//       });
//     } else {
//       console.log(`No matched disease found for page ${i + 1}`);
//       resultForPage.extractedOrder.push({
//         value: "No matched disease found",
//       });
//     }

//     // Add the page result to the results array, even if no matched diseases
//     results.push(resultForPage);
//   }

//   // Send the response with all results, including those with no matches
//   res.json(results);
// };

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

//       // Check if the label indicates a regex pattern
//       if (diagnosis_code === "Regex") {
//         regex = new RegExp(description, "gi"); // For regex matching
//       } else {
//         const escapedDescription = escapeRegex(description);
//         regex = new RegExp(`\\b${escapedDescription}\\b`, "gi"); // For plain text matching
//       }

//       // Find all matches in the normalized text
//       const matches = [...normalizedText.matchAll(regex)];

//       if (matches.length > 0) {
//         matches.forEach((match) => {
//           matchedDiseases.push({
//             code:diagnosis_code,
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

// ============Adding Socket.io
// import { createCanvas } from "canvas";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// import Tesseract from "tesseract.js";
// import mysql from "mysql2/promise";
// import { io } from "../app.js"; // Import the Socket.IO instance

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

// export const pdfUpload = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).send("No file uploaded.");
//   }

//   const pdfBytes = req.file.buffer;
//   const pdfDocument = await pdfjsLib.getDocument({
//     data: new Uint8Array(pdfBytes),
//   }).promise;
//   const numPages = pdfDocument.numPages;

//   const socketId = req.query.socketId; // Expecting the client to send socket ID
//   if (!socketId) {
//     return res.status(400).send("Socket ID is required.");
//   }

//   // Emit a message to the client that processing has started
//   io.to(socketId).emit("ocr_started", { totalPages: numPages });

//   // Initialize results array to hold results for all pages
//   const allResults = [];

//   // Iterate through all pages
//   for (let i = 0; i < numPages; i++) {
//     const imageBuffer = await pdfPageToImage(pdfBytes, i);
    
//     console.log(`Image buffer extracted for page ${i + 1}`);

//     const {
//       data: { text: ocrText },
//     } = await Tesseract.recognize(imageBuffer, "eng", {
//       logger: (info) => console.log(info),
//     });

//     console.log(`Extracted text from page ${i + 1}:`, ocrText);

//     let resultForPage = {
//       page: i + 1,
//       extractedOrder: [],
//       text: ocrText, // Include the raw OCR text
//       matchedDiseases: [], // Store matched diseases
//     };
    
//     // Normalize whitespace and lowercase the OCR text
//     const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, ' ').trim();
//     const normalizedText = normalizeWhitespace(ocrText.toLowerCase());

//     console.log(`Normalized text for page ${i + 1}:`, normalizedText);

//     // Match diseases with extracted text
//     const matchedDiseases = await matchWithDiseases(normalizedText);

//     if (matchedDiseases.length > 0) {
//       resultForPage.matchedDiseases = matchedDiseases; // Add matched diseases to the result
//       resultForPage.extractedOrder.push({
//         value: matchedDiseases,
//       });
//     } else {
//       resultForPage.extractedOrder.push({
//         value: "No matched disease found",
//       });
//     }

//     // Emit the result for this page to the client via the socket
//     io.to(socketId).emit("page_result", resultForPage);
//     allResults.push(resultForPage); // Store each page result
//   }

//   // Send a final completion message along with all results after processing
//   io.to(socketId).emit("ocr_completed", { message: "PDF processing completed", results: allResults });
  
//   // Send all results back to Postman
//   res.status(200).json({
//     message: "PDF processing completed",
//     totalPages: numPages,
//     results: allResults
//   });
// };
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

//       // Check if the label indicates a regex pattern
//       if (diagnosis_code === "Regex") {
//         regex = new RegExp(description, "gi"); // For regex matching
//       } else {
//         const escapedDescription = escapeRegex(description);
//         regex = new RegExp(`\\b${escapedDescription}\\b`, "gi"); // For plain text matching
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

import { createCanvas } from "canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract from "tesseract.js";
import mysql from "mysql2/promise";
import { io } from "../app.js"; // Import the Socket.IO instance

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

// Function to render a PDF page into an image
async function pdfPageToImage(pdfBuffer, pageIndex) {
  const pdfDocument = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
  }).promise;
  const page = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return canvas.toBuffer(); // Convert the rendered canvas to an image buffer
}

// Function to handle the OCR process for the uploaded PDF
export const pdfUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const pdfBytes = req.file.buffer;
  const pdfDocument = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes),
  }).promise;
  const numPages = pdfDocument.numPages;

  const socketId = req.query.socketId; // Expecting the client to send socket ID
  if (!socketId) {
    return res.status(400).send("Socket ID is required.");
  }

  // Emit a message to the client that processing has started
  io.to(socketId).emit("ocr_started", { totalPages: numPages });

  // Initialize results array to hold results for all pages
  const allResults = [];

  // Create a cancel flag for stopping the process
  const cancelFlag = { canceled: false };

  // Store the job in the activeJobs map
  activeJobs.set(socketId, cancelFlag);

  // Iterate through all pages
  for (let i = 0; i < numPages; i++) {
    if (cancelFlag.canceled) {
      console.log(`OCR process for socket ID ${socketId} has been canceled.`);
      break; // Stop processing if canceled
    }

    const imageBuffer = await pdfPageToImage(pdfBytes, i);
    
    console.log(`Image buffer extracted for page ${i + 1}`);

    const {
      data: { text: ocrText },
    } = await Tesseract.recognize(imageBuffer, "eng", {
      logger: (info) => console.log(info),
    });

    console.log(`Extracted text from page ${i + 1}:`, ocrText);

    let resultForPage = {
      page: i + 1,
      extractedOrder: [],
      text: ocrText, // Include the raw OCR text
      matchedDiseases: [], // Store matched diseases
    };

    const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, ' ').trim();
    const normalizedText = normalizeWhitespace(ocrText.toLowerCase());

    console.log(`Normalized text for page ${i + 1}:`, normalizedText);

    const matchedDiseases = await matchWithDiseases(normalizedText);

    if (matchedDiseases.length > 0) {
      resultForPage.matchedDiseases = matchedDiseases; // Add matched diseases to the result
      resultForPage.extractedOrder.push({
        value: matchedDiseases,
      });
    } else {
      resultForPage.extractedOrder.push({
        value: "No matched disease found",
      });
    }

    io.to(socketId).emit("page_result", resultForPage);
    allResults.push(resultForPage); // Store each page result
  }

  // If processing was not canceled, emit completion event
  if (!cancelFlag.canceled) {
    io.to(socketId).emit("ocr_completed", { message: "PDF processing completed", results: allResults });
  }

  // Clean up activeJobs map
  activeJobs.delete(socketId);

  // Send all results back to Postman or another client
  res.status(200).json({
    message: cancelFlag.canceled ? "Processing canceled" : "PDF processing completed",
    totalPages: numPages,
    results: allResults
  });
};

// NEW: Function to stop OCR process
export const stopOcrProcess = (req, res) => {
  const socketId = req.query.socketId;

  if (activeJobs.has(socketId)) {
    const job = activeJobs.get(socketId);
    job.canceled = true; // Set the cancel flag to true
    res.status(200).send("OCR process stopped.");
  } else {
    res.status(404).send("No active OCR process found for this socket ID.");
  }
};

// Function to match extracted text with database records
const matchWithDiseases = async (normalizedText) => {
  const connection = await getDbConnection();
  let matchedDiseases = [];

  try {
    const [diseaseList] = await connection.execute(
      "SELECT diagnosis_code, LOWER(description) AS description, label FROM medical_data"
    );

    const escapeRegex = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape special characters
    };

    diseaseList.forEach(({ description, label, diagnosis_code }) => {
      let regex;

      // Check if the label indicates a regex pattern
      if (diagnosis_code === "Regex") {
        regex = new RegExp(description, "gi"); // For regex matching
      } else {
        const escapedDescription = escapeRegex(description);
        regex = new RegExp(`\\b${escapedDescription}\\b`, "gi"); // For plain text matching
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
