// Importing the default NodeJS modules
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';

// Importing Third Party Libraries
import express from 'express';
import 'dotenv/config';

// Importing Internal Modules
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';
import ocrRoutes from './routes/ocr/ocrRoutes.js';

// Creating an instance of the Express application
const app = express();

// Setting the port number to either the value from the environment variable `PORT` or 9000 as a fallback
const port = process.env.PORT || 9000;

// Getting the filename and the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Adding middleware to parse JSON data and URL-encoded data in requests
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Load disease data
let diseaseList = {};

const loadDiseaseData = async () => {
  try {
    const data = fs.readFileSync(join(__dirname, 'public', 'diseases.json'), 'utf8');
    const parsedData = JSON.parse(data);
    
    if (!Array.isArray(parsedData)) {
      throw new Error('Expected data to be an array');
    }

    diseaseList = parsedData.reduce((acc, { Description, Code, Label }) => {
      const normalizedDescription = Description.toLowerCase();
      if (!acc[Code]) {
        acc[Code] = { descriptions: [], labels: [] };
      }
      if (!acc[Code].descriptions.includes(normalizedDescription)) {
        acc[Code].descriptions.push(normalizedDescription);
      }
      if (Label && !acc[Code].labels.includes(Label)) {
        acc[Code].labels.push(Label);
      }
      return acc;
    }, {});

  } catch (error) {
    console.error('Error loading diseases data:', error);
  }
};

loadDiseaseData();

export { diseaseList }; // Export the diseaseList

// console.log(diseaseList);

// Helper function to extract dates
export const extractDates = (text) => {
  const datePatterns = [
    /(?:published on|date of birth|encounter date|date|generated on|created on|updated on|dob|date reviewed|date of issue|Problem List as of)\s*[:\-—\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*(?:\d{1,2}:\d{2}\s*[APM]{2})?/gi,
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/g,
    /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
    /\b(\d{2}[-/]\d{2}[-/]\d{2})\b/g,
  ];

  const dates = new Set();
  datePatterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((date) => dates.add(date));
    }
  });
  return Array.from(dates);
};

// Routes
app.use('/api/ocr', ocrRoutes);



// Serving static files from the `public` directory
if (process.env.NODE_ENV === 'production') {
  const buildPath = resolve(__dirname, 'frontend', 'dist');
  app.use(express.static(buildPath));

  app.get('*', (req, res) =>
    res.sendFile(resolve(buildPath, 'index.html'))
  );
} else {
  app.get('/', (req, res) => {
    res.send('API is running....');
  });
}

app.use(express.static(join(__dirname, 'public')));

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Starting the server and listening on the specified port
app.listen(port, () => {
  console.log(`Server listening on port: ${port}`);
});
