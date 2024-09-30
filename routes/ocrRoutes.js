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

import express from'express'
import multer from "multer";

import {fileUpload} from'../controllers/ocrExtractController.js'
const router = express.Router()
// GET extracted text
// router.get('/file-upload',textExtraction)

const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST a file
router.post('/upload', upload.single("pdf"), fileUpload)

export default router;