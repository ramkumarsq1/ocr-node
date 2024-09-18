import express from "express";
import { generateOCRfromlivefiles } from "../../controllers/ocrController.js";


const router = express.Router();

// Create a new project
router.post("", generateOCRfromlivefiles);

// // Get all projects
// router.get("", getAllProjects);

// // Get a single project by ID
// router.get("/:id", getSingleProject);

// // Update a project by ID
// router.put("/:id", updateProject);

// // Delete a project by ID
// router.delete("/:id", deleteProject);

export default router;