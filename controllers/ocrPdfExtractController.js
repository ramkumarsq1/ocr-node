
// // // ====working fine dont touch
// // import { createCanvas } from "canvas";
// // import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// // import Tesseract from "tesseract.js";
// // import mysql from "mysql2/promise";
// // import { io } from "../app.js"; // Import the Socket.IO instance

// // // Store active processing jobs by socket ID
// // const activeJobs = new Map();

// // // Function to get a database connection
// // const getDbConnection = async () => {
// //   return mysql.createConnection({
// //     host: process.env.DB_HOST,
// //     user: process.env.DB_USER,
// //     password: process.env.DB_PASSWORD,
// //     database: process.env.DB_NAME,
// //     port: process.env.DB_PORT,
// //   });
// // };

// // // Function to render a PDF page into an image
// // async function pdfPageToImage(pdfBuffer, pageIndex) {
// //   const pdfDocument = await pdfjsLib.getDocument({
// //     data: new Uint8Array(pdfBuffer),
// //   }).promise;
// //   const page = await pdfDocument.getPage(pageIndex + 1);
// //   const viewport = page.getViewport({ scale: 1.5 });
// //   const canvas = createCanvas(viewport.width, viewport.height);
// //   const context = canvas.getContext("2d");

// //   await page.render({
// //     canvasContext: context,
// //     viewport: viewport,
// //   }).promise;

// //   return canvas.toBuffer(); // Convert the rendered canvas to an image buffer
// // }

// // // Function to handle the OCR process for the uploaded PDF
// // export const pdfUpload = async (req, res) => {
// //   if (!req.file) {
// //     return res.status(400).send("No file uploaded.");
// //   }

// //   const pdfBytes = req.file.buffer;
// //   const pdfDocument = await pdfjsLib.getDocument({
// //     data: new Uint8Array(pdfBytes),
// //   }).promise;
// //   const numPages = pdfDocument.numPages;

// //   const socketId = req.query.socketId; // Expecting the client to send socket ID
// //   if (!socketId) {
// //     return res.status(400).send("Socket ID is required.");
// //   }

// //   // Emit a message to the client that processing has started
// //   io.to(socketId).emit("ocr_started", { totalPages: numPages });

// //   // Initialize results array to hold results for all pages
// //   const allResults = [];

// //   // Create a cancel flag for stopping the process
// //   const cancelFlag = { canceled: false };

// //   // Store the job in the activeJobs map
// //   activeJobs.set(socketId, cancelFlag);

// //   // Iterate through all pages
// //   for (let i = 0; i < numPages; i++) {
// //     if (cancelFlag.canceled) {
// //       console.log(`OCR process for socket ID ${socketId} has been canceled.`);
// //       break; // Stop processing if canceled
// //     }

// //     const imageBuffer = await pdfPageToImage(pdfBytes, i);

// //     console.log(`Image buffer extracted for page ${i + 1}`);

// //     const {
// //       data: { text: ocrText },
// //     } = await Tesseract.recognize(imageBuffer, "eng", {
// //       logger: (info) => console.log(info),
// //     });

// //     console.log(`Extracted text from page ${i + 1}:`, ocrText);

// //     let resultForPage = {
// //       page: i + 1,
// //       extractedOrder: [],
// //       text: ocrText, // Include the raw OCR text
// //       matchedDiseases: [], // Store matched diseases
// //     };

// //     const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, ' ').trim();
// //     const normalizedText = normalizeWhitespace(ocrText.toLowerCase());

// //     console.log(`Normalized text for page ${i + 1}:`, normalizedText);

// //     const matchedDiseases = await matchWithDiseases(normalizedText);

// //     if (matchedDiseases.length > 0) {
// //       resultForPage.matchedDiseases = matchedDiseases; // Add matched diseases to the result
// //       resultForPage.extractedOrder.push({
// //         value: matchedDiseases,
// //       });
// //     } else {
// //       resultForPage.extractedOrder.push({
// //         value: "No matched diagnosis found",
// //       });
// //     }

// //     io.to(socketId).emit("page_result", resultForPage);
// //     allResults.push(resultForPage); // Store each page result
// //   }

// //   // If processing was not canceled, emit completion event
// //   if (!cancelFlag.canceled) {
// //     io.to(socketId).emit("ocr_completed", { message: "PDF processing completed", results: allResults });
// //   }

// //   // Clean up activeJobs map
// //   activeJobs.delete(socketId);

// //   // Send all results back to Postman or another client
// //   res.status(200).json({
// //     message: cancelFlag.canceled ? "Processing canceled" : "PDF processing completed",
// //     totalPages: numPages,
// //     results: allResults
// //   });
// // };

// // // NEW: Function to stop OCR process
// // export const stopOcrProcess = (req, res) => {
// //   const socketId = req.query.socketId;

// //   if (activeJobs.has(socketId)) {
// //     const job = activeJobs.get(socketId);
// //     job.canceled = true; // Set the cancel flag to true
// //     res.status(200).send("OCR process stopped.");
// //   } else {
// //     res.status(404).send("No active OCR process found for this socket ID.");
// //   }
// // };

// // // Function to match extracted text with database records
// // const matchWithDiseases = async (normalizedText) => {
// //   const connection = await getDbConnection();
// //   let matchedDiseases = [];

// //   try {
// //     const [diseaseList] = await connection.execute(
// //       "SELECT diagnosis_code, LOWER(description) AS description, label FROM medical_data"
// //     );

// //     const escapeRegex = (string) => {
// //       return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape special characters
// //     };

// //     const primaryCodes = new Set(); // To store matched primary codes
// //     const secondaryCodes = new Set(); // To store matched secondary codes

// //     diseaseList.forEach(({ description, label, diagnosis_code }) => {
// //       let regex;

// //       // Check if the label indicates a regex pattern
// //       if (diagnosis_code === "Regex") {
// //         regex = new RegExp(description, "gi"); // For regex matching
// //       } else {
// //         const escapedDescription = escapeRegex(description);
// //         regex = new RegExp(`\\b${escapedDescription}\\b`, "gi"); // For plain text matching
// //       }

// //       const matches = [...normalizedText.matchAll(regex)];

// //       //   if (matches.length > 0) {
// //       //     matches.forEach((match) => {
// //       //       matchedDiseases.push({
// //       //         code: diagnosis_code,
// //       //         description: match[0],
// //       //         label,
// //       //         index: match.index,
// //       //       });
// //       //     });
// //       //   }
// //       // });

// //       // matchedDiseases.sort((a, b) => a.index - b.index);


// //       if (matches.length > 0) {
// //         matches.forEach((match) => {
// //           const diseaseInfo = {
// //             code: diagnosis_code,
// //             description: match[0],
// //             label,
// //             index: match.index,
// //           };

// //           matchedDiseases.push(diseaseInfo);

// //           // Determine if the code is primary or secondary
// //           if (isPrimaryCode(diagnosis_code)) {
// //             primaryCodes.add(diagnosis_code);
// //           } else if (isSecondaryCode(diagnosis_code)) {
// //             secondaryCodes.add(diagnosis_code);
// //           }
// //         });
// //       }
// //     });

// //     // Add combination code if both primary and secondary codes are matched
// //     if (primaryCodes.has("J44.9") && secondaryCodes.has("F32A")) {
// //       matchedDiseases.push({
// //         code: "JF321",
// //         description: 'Combination of primary (J44.9) and secondary (F32A) codes',
// //         label: 'Combination',
// //         // index: Infinity, // Ensure it is added at the end
// //       });
// //     }

// //     // Sort matchedDiseases based on index
// //     matchedDiseases.sort((a, b) => a.index - b.index);


// //   } catch (error) {
// //     console.error("Error fetching from database:", error);
// //     throw error;
// //   } finally {
// //     await connection.end();
// //   }

// //   return matchedDiseases;
// // };

// // // Placeholder functions for determining code types
// // const isPrimaryCode = (code) => {
// //   // Define primary codes (example)
// //   return code === "J44.9"; // Modify as needed
// // };

// // const isSecondaryCode = (code) => {
// //   // Define secondary codes (example)
// //   return code === "F32A"; // Modify as needed
// // };

// import { createCanvas } from "canvas";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// import Tesseract from "tesseract.js";
// import mysql from "mysql2/promise";
// import { io } from "../app.js"; // Import the Socket.IO instance

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

// // Function to render a PDF page into an image
// async function pdfPageToImage(pdfBuffer, pageIndex) {
//   const pdfDocument = await pdfjsLib.getDocument({
//     data: new Uint8Array(pdfBuffer),
//   }).promise;
//   const page = await pdfDocument.getPage(pageIndex + 1);
//   const viewport = page.getViewport({ scale: 1.5 });
//   const canvas = createCanvas(viewport.width, viewport.height);
//   const context = canvas.getContext("2d");

//   await page.render({
//     canvasContext: context,
//     viewport: viewport,
//   }).promise;

//   return canvas.toBuffer(); // Convert the rendered canvas to an image buffer
// }

// // Function to handle the OCR process for the uploaded PDF
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

//   // Create a cancel flag for stopping the process
//   const cancelFlag = { canceled: false };

//   // Store the job in the activeJobs map
//   activeJobs.set(socketId, cancelFlag);

//   // Iterate through all pages
//   for (let i = 0; i < numPages; i++) {
//     if (cancelFlag.canceled) {
//       console.log(`OCR process for socket ID ${socketId} has been canceled.`);
//       break; // Stop processing if canceled
//     }

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

//     const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, ' ').trim();
//     const normalizedText = normalizeWhitespace(ocrText.toLowerCase());

//     console.log(`Normalized text for page ${i + 1}:`, normalizedText);

//     const matchedDiseases = await matchWithDiseases(normalizedText);

//     if (matchedDiseases.length > 0) {
//       resultForPage.matchedDiseases = matchedDiseases; // Add matched diseases to the result
//       resultForPage.extractedOrder.push({
//         value: matchedDiseases,
//       });
//     } else {
//       resultForPage.extractedOrder.push({
//         value: "No matched diagnosis found",
//       });
//     }

//     io.to(socketId).emit("page_result", resultForPage);
//     allResults.push(resultForPage); // Store each page result
//   }

//   // If processing was not canceled, emit completion event
//   if (!cancelFlag.canceled) {
//     io.to(socketId).emit("ocr_completed", { message: "PDF processing completed", results: allResults });
//   }

//   // Clean up activeJobs map
//   activeJobs.delete(socketId);

//   // Send all results back to Postman or another client
//   res.status(200).json({
//     message: cancelFlag.canceled ? "Processing canceled" : "PDF processing completed",
//     totalPages: numPages,
//     results: allResults
//   });
// };

// // NEW: Function to stop OCR process
// export const stopOcrProcess = (req, res) => {
//   const socketId = req.query.socketId;

//   if (activeJobs.has(socketId)) {
//     const job = activeJobs.get(socketId);
//     job.canceled = true; // Set the cancel flag to true
//     res.status(200).send("OCR process stopped.");
//   } else {
//     res.status(404).send("No active OCR process found for this socket ID.");
//   }
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

//     const primaryCodes = new Set(); // To store matched primary codes
//     const secondaryCodes = new Set(); // To store matched secondary codes

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

//       //   if (matches.length > 0) {
//       //     matches.forEach((match) => {
//       //       matchedDiseases.push({
//       //         code: diagnosis_code,
//       //         description: match[0],
//       //         label,
//       //         index: match.index,
//       //       });
//       //     });
//       //   }
//       // });

//       // matchedDiseases.sort((a, b) => a.index - b.index);


//       if (matches.length > 0) {
//         matches.forEach((match) => {
//           const diseaseInfo = {
//             code: diagnosis_code,
//             description: match[0],
//             label,
//             index: match.index,
//           };

//           matchedDiseases.push(diseaseInfo);

//           // Determine if the code is primary or secondary
//           if (isPrimaryCode(diagnosis_code)) {
//             primaryCodes.add(diagnosis_code);
//           } else if (isSecondaryCode(diagnosis_code)) {
//             secondaryCodes.add(diagnosis_code);
//           }
//         });
//       }
//     });
//     // Add combination code if both primary and secondary codes are matched
//     if (primaryCodes.has("J44.9") && secondaryCodes.has("F32A")) {
//       matchedDiseases.push({
//         code: "JF321",
//         description: 'Combination of primary (J44.9) and secondary (F32A) codes',
//         label: 'Combination',
//         // index: Infinity, // Ensure it is added at the end
//       });
//     }

//     // Sort matchedDiseases based on index
//     matchedDiseases.sort((a, b) => a.index - b.index);


//   } catch (error) {
//     console.error("Error fetching from database:", error);
//     throw error;
//   } finally {
//     await connection.end();
//   }

//   return matchedDiseases;
// };

// // Placeholder functions for determining code types
// const isPrimaryCode = (code) => {
//   // Define primary codes (example)
//   return code === "J44.9"; // Modify as needed
// };

// const isSecondaryCode = (code) => {
//   // Define secondary codes (example)
//   return code === "F32A"; // Modify as needed
// };



// // ====working fine dont touch
// import { createCanvas } from "canvas";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// import Tesseract from "tesseract.js";
// import mysql from "mysql2/promise";
// import { io } from "../app.js"; // Import the Socket.IO instance

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

// // Function to render a PDF page into an image
// async function pdfPageToImage(pdfBuffer, pageIndex) {
//   const pdfDocument = await pdfjsLib.getDocument({
//     data: new Uint8Array(pdfBuffer),
//   }).promise;
//   const page = await pdfDocument.getPage(pageIndex + 1);
//   const viewport = page.getViewport({ scale: 1.5 });
//   const canvas = createCanvas(viewport.width, viewport.height);
//   const context = canvas.getContext("2d");

//   await page.render({
//     canvasContext: context,
//     viewport: viewport,
//   }).promise;

//   return canvas.toBuffer(); // Convert the rendered canvas to an image buffer
// }

// // Function to handle the OCR process for the uploaded PDF
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

//   // Create a cancel flag for stopping the process
//   const cancelFlag = { canceled: false };

//   // Store the job in the activeJobs map
//   activeJobs.set(socketId, cancelFlag);

//   // Iterate through all pages
//   for (let i = 0; i < numPages; i++) {
//     if (cancelFlag.canceled) {
//       console.log(`OCR process for socket ID ${socketId} has been canceled.`);
//       break; // Stop processing if canceled
//     }

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

//     const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, ' ').trim();
//     const normalizedText = normalizeWhitespace(ocrText.toLowerCase());

//     console.log(`Normalized text for page ${i + 1}:`, normalizedText);

//     const matchedDiseases = await matchWithDiseases(normalizedText);

//     if (matchedDiseases.length > 0) {
//       resultForPage.matchedDiseases = matchedDiseases; // Add matched diseases to the result
//       resultForPage.extractedOrder.push({
//         value: matchedDiseases,
//       });
//     } else {
//       resultForPage.extractedOrder.push({
//         value: "No matched diagnosis found",
//       });
//     }

//     io.to(socketId).emit("page_result", resultForPage);
//     allResults.push(resultForPage); // Store each page result
//   }

//   // If processing was not canceled, emit completion event
//   if (!cancelFlag.canceled) {
//     io.to(socketId).emit("ocr_completed", { message: "PDF processing completed", results: allResults });
//   }

//   // Clean up activeJobs map
//   activeJobs.delete(socketId);

//   // Send all results back to Postman or another client
//   res.status(200).json({
//     message: cancelFlag.canceled ? "Processing canceled" : "PDF processing completed",
//     totalPages: numPages,
//     results: allResults
//   });
// };

// // NEW: Function to stop OCR process
// export const stopOcrProcess = (req, res) => {
//   const socketId = req.query.socketId;

//   if (activeJobs.has(socketId)) {
//     const job = activeJobs.get(socketId);
//     job.canceled = true; // Set the cancel flag to true
//     res.status(200).send("OCR process stopped.");
//   } else {
//     res.status(404).send("No active OCR process found for this socket ID.");
//   }
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

//     const primaryCodes = new Set(); // To store matched primary codes
//     const secondaryCodes = new Set(); // To store matched secondary codes

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

//       //   if (matches.length > 0) {
//       //     matches.forEach((match) => {
//       //       matchedDiseases.push({
//       //         code: diagnosis_code,
//       //         description: match[0],
//       //         label,
//       //         index: match.index,
//       //       });
//       //     });
//       //   }
//       // });

//       // matchedDiseases.sort((a, b) => a.index - b.index);


//       if (matches.length > 0) {
//         matches.forEach((match) => {
//           const diseaseInfo = {
//             code: diagnosis_code,
//             description: match[0],
//             label,
//             index: match.index,
//           };

//           matchedDiseases.push(diseaseInfo);

//           // Determine if the code is primary or secondary
//           if (isPrimaryCode(diagnosis_code)) {
//             primaryCodes.add(diagnosis_code);
//           } else if (isSecondaryCode(diagnosis_code)) {
//             secondaryCodes.add(diagnosis_code);
//           }
//         });
//       }
//     });

//     // Add combination code if both primary and secondary codes are matched
//     if (primaryCodes.has("J44.9") && secondaryCodes.has("F32A")) {
//       matchedDiseases.push({
//         code: "JF321",
//         description: 'Combination of primary (J44.9) and secondary (F32A) codes',
//         label: 'Combination',
//         // index: Infinity, // Ensure it is added at the end
//       });
//     }

//     // Sort matchedDiseases based on index
//     matchedDiseases.sort((a, b) => a.index - b.index);


//   } catch (error) {
//     console.error("Error fetching from database:", error);
//     throw error;
//   } finally {
//     await connection.end();
//   }

//   return matchedDiseases;
// };

// // Placeholder functions for determining code types
// const isPrimaryCode = (code) => {
//   // Define primary codes (example)
//   return code === "J44.9"; // Modify as needed
// };

// const isSecondaryCode = (code) => {
//   // Define secondary codes (example)
//   return code === "F32A"; // Modify as needed
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
  const viewport = page.getViewport({ scale: 3 });
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

    // console.log(`Image buffer extracted for page ${i + 1}`);

    const {
      data: { text: ocrText },
    } = await Tesseract.recognize(imageBuffer, "eng", {
      // logger: (info) => console.log(info),
    });

    // console.log(`Extracted text from page ${i + 1}:`, ocrText);

    let resultForPage = {
      page: i + 1,
      extractedOrder: [],
      text: ocrText, // Include the raw OCR text
      matchedDiseases: [], // Store matched diseases
    };

    const normalizeWhitespace = (ocrText) => ocrText.replace(/\s+/g, ' ').trim();
    const normalizedText = normalizeWhitespace(ocrText.toLowerCase());

    // console.log(`Normalized text for page ${i + 1}:`, normalizedText);

    const matchedDiseases = await matchWithDiseases(normalizedText);

    if (matchedDiseases.length > 0) {
      resultForPage.matchedDiseases = matchedDiseases; // Add matched diseases to the result
      resultForPage.extractedOrder.push({
        value: matchedDiseases,
      });
    } else {
      resultForPage.extractedOrder.push({
        value: "No matched diagnosis found",
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
  let primaryCodes = new Set();
  let secondaryCodes = new Set();

  try {
    // Step 1: Fetch diseases from the medical_data table
    const [diseaseList] = await connection.execute(
      "SELECT diagnosis_code, LOWER(description) AS description, label FROM medical_data"
    );

    const escapeRegex = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape special characters
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
              // console.log(diagnosis_code);
              // console.log(secondaryCodes);
            }
          }
        }
      }
    }

    // Step 3: Fetch combination codes based on matched primary and secondary codes
    const combinationCodes = await getCombinationCodes(connection, primaryCodes, matchedDiseases);
    matchedDiseases.push(...combinationCodes);

    // console.log("primaryCodes");
    // console.log(primaryCodes);
    // console.log("secondaryCodes");
    // console.log(secondaryCodes);
    // console.log("combinationCodes");
    // console.log(combinationCodes);


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

// Helper function to fetch combination codes from the database
// const getCombinationCodes = async (connection, primaryCodes, secondaryCodes) => {
//   let combinationCodes = [];

//   if (primaryCodes.size > 0 && secondaryCodes.size > 0) {
//     const primaryCodeList = Array.from(primaryCodes).map(code => `'${code}'`).join(',');
//     const secondaryCodeList = Array.from(secondaryCodes).map(code => `'${code}'`).join(',');

//     // console.log(primaryCodeList);
//     // console.log(secondaryCodeList);

//     const query = `
//       SELECT combo_code FROM combination_codes 
//       WHERE primary_code IN (${primaryCodeList}) 
//       AND secondary_code IN (${secondaryCodeList})
//     `;

//     const [results] = await connection.execute(query);
//     combinationCodes = results.map(row => ({
//       code: row.combo_code,
//       description: `Combination of primary codes [${Array.from(primaryCodes).join(', ')}] and secondary codes [${Array.from(secondaryCodes).join(', ')}]`,
//       label: 'Combination',
//       index: row.index // Ensure combination codes are added at the end
//     }));
//   }

//   return combinationCodes;
// };

// const getCombinationCodes = async (connection, primaryCodes, matchedDiseases) => {
//   let combinationCodes = [];

//   for (const primaryCode of primaryCodes) {
//     const secondaryCodes = await getSecondaryCodesForPrimary(primaryCode, connection);

//     // Check if any of these secondary codes are part of matched diseases
//     for (const secondaryCode of secondaryCodes) {
//       // Find the matched disease that corresponds to the secondary code
//       const matchedDisease = matchedDiseases.find(disease => disease.code === secondaryCode);
//       if (matchedDisease) {
//         combinationCodes.push({
//           code: `Combo-${primaryCode}-${secondaryCode}`, // Custom logic for combo code
//           description: `Combination of primary code [${primaryCode}] and secondary code [${secondaryCode}]`,
//           label: 'Combination',
//           index: matchedDisease.index, // Use the index from the matched disease
//         });
//       }
//     }
//   }

//   return combinationCodes;
// };


const getCombinationCodes = async (connection, primaryCodes, matchedDiseases) => {
  let combinationCodes = [];

  for (const primaryCode of primaryCodes) {
    const secondaryCodes = await getSecondaryCodesForPrimary(primaryCode, connection);

    // Check if any of these secondary codes are part of matched diseases
    for (const secondaryCode of secondaryCodes) {
      // Find the matched disease that corresponds to the secondary code
      const matchedDisease = matchedDiseases.find(disease => disease.code === secondaryCode);
      if (matchedDisease) {
        const comboCode = await fetchCombinationCodeFromDb(connection, primaryCode, secondaryCode);

        if (comboCode) {
          combinationCodes.push({
            code: comboCode, // Get the combo code from the database
            description: `Combination of primary code ${primaryCode} and secondary code ${secondaryCode}`,
            label: 'Combination',
            index: matchedDisease.index !== undefined ? matchedDisease.index : Infinity, // Use the index from the matched disease
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
  return results.map(row => row.secondary_code);
};


// Function to fetch the combination code from the database
const fetchCombinationCodeFromDb = async (connection, primaryCode, secondaryCode) => {
  const [results] = await connection.execute(
    "SELECT combo_code FROM combination_codes WHERE primary_code = ? AND secondary_code = ?",
    [primaryCode, secondaryCode]
  );
  return results.length > 0 ? results[0].combo_code : null; // Return the combo code or null if not found
};