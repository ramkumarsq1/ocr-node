// import express from "express";
// import { generateOCRfromlivefiles } from "../../controllers/ocrController.js";


// const router = express.Router();

// // Create a new project
// router.post("/upload-pdf", generateOCRfromlivefiles);

// // // Get all projects
// // router.get("", getAllProjects);

// // // Get a single project by ID
// // router.get("/:id", getSingleProject);

// // // Update a project by ID
// // router.put("/:id", updateProject);

// // // Delete a project by ID
// // router.delete("/:id", deleteProject);

// export default router;

// import express from'express'
// import multer from "multer";

// import {pdfUpload} from'../controllers/ocrPdfExtractController.js'
// import {fileUpload} from'../controllers/ocrLiveExtractController.js'
// const router = express.Router()
// // GET extracted text
// // router.get('/file-upload',textExtraction)

// const storage = multer.memoryStorage();
// const upload = multer({ storage });


// router.get("/", (req, res) => {
//     res.send({ response: "I am alive" }).status(200);
//   });

// // POST a pdf
// router.post('/pdf', upload.single("pdf"), pdfUpload);

// // POST a filename with page numbers
// router.post('/file', fileUpload)

// export default router;

import express from 'express';
import multer from "multer";

// import { pdfUpload, stopOcrProcess } from '../controllers/ocrPdfExtractController.js';
// import { fileUpload ,stopOcrProcess} from '../controllers/ocrLiveExtractController.js';

import { pdfUpload,stopOcrProcess } from '../controllers/ocrPdfExtractController.js';
import { fileUpload, } from '../controllers/ocrLiveExtractController.js';


const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/", (req, res) => {
    res.send({ response: "I am alive" }).status(200);
});

// POST a PDF
router.post('/pdf', upload.single("pdf"), pdfUpload);

// POST a filename with page numbers
router.post('/file', fileUpload);

// NEW: Stop OCR process
router.post('/stop', stopOcrProcess);
// router.post('/stop/live', stopLiveOcrProcess);

export default router;
