import fetch from 'node-fetch'; // Ensure you're using the right package
import Tesseract from 'tesseract.js'; // Ensure Tesseract.js is installed
import sharp from 'sharp';

import { diseaseList, extractDates } from '../app.js';

// generate OCR from live files
export const generateOCRfromlivefiles = async (req, res, next) => {
  const { baseUrl, startPage, endPage } = req.body;

  if (!baseUrl) {
    return res.status(400).json({ error: 'Please provide a base URL.' });
  }

  const results = [];

  // Optimize image processing by preprocessing
const preprocessImage = async (imageBuffer) => {
    try {
      // Convert image to grayscale, resize, and optimize
      const processedBuffer = await sharp(imageBuffer)
        // .resize({ width: 1200 }) // Resize to width of 1200px; adjust as needed
        .grayscale() // Convert to grayscale
        .toBuffer(); // Convert processed image to buffer
      return processedBuffer;
    } catch (error) {
      console.error('Error preprocessing image:', error);
      throw error;
    }
  };

  const processPage = async (pageNumber) => {
    try {
      const imageUrl = `https://archdocviewer.cioxhealth.com/docviewer/Handlers/AzureDocViewerHandler.ashx?ataladocpage=${pageNumber - 1}&atala_docurl=${baseUrl}&atala_doczoom=1&atala_thumbpadding=false`;
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image. Status: ${response.status}`);
      }

      // Use `response.arrayBuffer()` instead of `response.buffer()`
      const imageBuffer = await response.arrayBuffer();

      const preprocessedBuffer = await preprocessImage(Buffer.from(imageBuffer));

      const { data: { text } } = await Tesseract.recognize(Buffer.from(preprocessedBuffer), 'eng', {
        logger: (info) => console.log(info),
      });

      const matchedDiseases = Object.entries(diseaseList)
        .map(([code, { descriptions, labels }]) => {
          const exactMatch = descriptions.find(
            (description) =>
              text.toLowerCase().includes(description) &&
              new RegExp(`\\b${description}\\b`).test(text.toLowerCase())
          );
          return exactMatch
            ? { code, description: exactMatch, labels }
            : null;
        })
        .filter(Boolean);

      const dates = extractDates(text);

      return {
        page: pageNumber,
        img: imageUrl,
        text,
        diseases: matchedDiseases.length > 0 ? matchedDiseases : 'No diseases found',
        dates: dates.length > 0 ? dates : 'No dates found',
      };

    } catch (error) {
      console.error(`Error processing page ${pageNumber}:`, error);
      return {
        page: pageNumber,
        text: 'Error processing page.',
        diseases: 'Error fetching diseases',
        dates: 'Error extracting dates',
        img: '',
      };
    }
  };

  try {
    const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    for (let i = 0; i < pageNumbers.length; i += 2) {
      const batch = pageNumbers.slice(i, i + 2);
      const resultsForBatch = await Promise.all(batch.map(processPage));
      results.push(...resultsForBatch);
    }
    res.json(results);
  } catch (error) {
    console.error('Error processing pages:', error);
    res.status(500).json({ error: 'Error processing pages.' });
  }
};
