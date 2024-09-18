import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import * as xlsx from 'xlsx';  // Import the xlsx library
import path from 'path';

const app = new Hono();
interface Report {
  work_year: number;
  job_title: string;
  salary: number;
}

// Middleware to handle CORS
app.use('*', (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*'); // or your frontend domain
  c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  return next();
});

// Function to read and parse Excel data
const readExcelData = (): Report[] => {
  const filePath = path.resolve(__dirname, '../data/salaries.xlsx'); // Path to the Excel file
  
  // Read the Excel file
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet

  // Parse the sheet into JSON and cast it to the Report[] type
  const worksheet = xlsx.utils.sheet_to_json<Report>(workbook.Sheets[sheetName]);  
  return worksheet;  // Now TypeScript knows this is an array of Report
};

// Define a basic route
app.get('/', (c) => {
  return c.json({ message: 'Welcome to the Hono API' });
});

// Route to fetch all reports
app.get('/reports', (c) => {
  try {
    // Read the data from the Excel file
    const data = readExcelData();

    // Create an object to summarize the data by year
    const reportSummary: { [key: string]: { totalJobs: number; totalSalary: number } } = {};

    // Loop through each row in the Excel data
    data.forEach((row: Report) => {
      // Validate that year, salary are defined before processing
      if (row.work_year && row.salary) {
        const work_year = row.work_year.toString(); // Convert the work_year to a string for use as a key

        // Check if this work_year already exists in the reportSummary object
        if (!reportSummary[work_year]) {
          // If not, initialize the work_year with 0 total jobs and 0 total salary
          reportSummary[work_year] = { totalJobs: 0, totalSalary: 0 };
        }

        // Increment the total number of jobs for the work_year
        reportSummary[work_year].totalJobs += 1;

        // Add the salary for the current row to the total salary for the work_year
        reportSummary[work_year].totalSalary += row.salary;
      } else {
        console.warn(`Skipping invalid row: ${JSON.stringify(row)}`);
      }
    });

    // Create a final array of reports for each work_year, calculating the average salary
    const reports = Object.keys(reportSummary).map(work_year => {
      const { totalJobs, totalSalary } = reportSummary[work_year];

      // Calculate the average salary by dividing the total salary by the total number of jobs
      const averageSalary = Math.round(totalSalary / totalJobs);

      // Return the summary data for the work_year
      return {
        year: parseInt(work_year), // Convert the year string back to a number
        totalJobs, // Total number of jobs for the year
        averageSalary // Average salary for the year
      };
    });

    // Respond with the summarized report data as JSON
    return c.json(reports);
  } catch (error) {
    console.error("Error processing /reports route:", error);
    return c.json({ message: 'Failed to process reports' }, 500);
  }
});

// Route to fetch reports for a specific year
app.get('/reports/:year', (c) => {
  const yearParam = c.req.param('year'); // Get the year from the URL parameter
  const year = parseInt(yearParam, 10);  
  const data = readExcelData(); // Read data from Excel

  // Filter the data for the requested year
  const filteredData = data.filter((row) => row.work_year === year);
  
  if (filteredData.length === 0) {
    return c.json({ message: `No data found for year ${year}` }, 404); // If no data found for the given year
  }

  // Create an object to count the occurrences of each job title
  const jobTitleCounts: { [jobtitle: string]: number } = {};

  // Loop through the filtered data to count occurrences of each job title
  filteredData.forEach((row) => {
    if (row.job_title) {
      if (!jobTitleCounts[row.job_title]) {
        jobTitleCounts[row.job_title] = 0;
      }
      jobTitleCounts[row.job_title] += 1; // Increment the count for the job title
    }
  });

  // Prepare the result as an array of job titles with their counts
  const result = Object.keys(jobTitleCounts).map((job_title) => ({
    job_title, // Job title
    count: jobTitleCounts[job_title] // Number of times the job title appeared
  }));

  // Return the result as JSON
  return c.json(result);
});

// Start the server
serve(app); 
console.log('Hono API is running on http://localhost:3000');
