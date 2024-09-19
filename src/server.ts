import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import path from 'path';
import fs from 'fs';

const app = new Hono();

interface Report {
  work_year: number;
  job_title: string;
  salary: number;
}

// Apply CORS middleware
app.use('/api/*', cors());
app.use(
  '/api2/*',
  cors({
    origin: 'http://example.com',
    allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
    credentials: true,
  })
);

// Load data from JSON file
const readJSONData = (): Report[] => {
  const filePath = path.resolve(__dirname, '../data/salaries.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
};

// Define a basic route
app.get('/', (c) => {
  return c.json({ message: 'Welcome to the Hono API' });
});

// Route to fetch all reports
app.get('/reports', (c) => {
  try {
    const data = readJSONData();

    const reportSummary: { [key: string]: { totalJobs: number; totalSalary: number } } = {};

    data.forEach((row: Report) => {
      if (row.work_year && row.salary) {
        const work_year = row.work_year.toString();
        if (!reportSummary[work_year]) {
          reportSummary[work_year] = { totalJobs: 0, totalSalary: 0 };
        }

        reportSummary[work_year].totalJobs += 1;
        reportSummary[work_year].totalSalary += row.salary;
      }
    });

    const reports = Object.keys(reportSummary).map(work_year => {
      const { totalJobs, totalSalary } = reportSummary[work_year];
      const averageSalary = Math.round(totalSalary / totalJobs);
      return {
        year: parseInt(work_year),
        totalJobs,
        averageSalary,
      };
    });

    return c.json(reports);
  } catch (error) {
    console.error("Error processing /reports route:", error);
    return c.json({ message: 'Failed to process reports' }, 500);
  }
});

// Route to fetch reports for a specific year
app.get('/reports/:year', (c) => {
  const yearParam = c.req.param('year');
  const year = parseInt(yearParam, 10);
  const data = readJSONData();

  const filteredData = data.filter((row) => row.work_year === year);
  
  if (filteredData.length === 0) {
    return c.json({ message: `No data found for year ${year}` }, 404);
  }

  const jobTitleCounts: { [jobtitle: string]: number } = {};

  filteredData.forEach((row) => {
    if (row.job_title) {
      if (!jobTitleCounts[row.job_title]) {
        jobTitleCounts[row.job_title] = 0;
      }
      jobTitleCounts[row.job_title] += 1;
    }
  });

  const result = Object.keys(jobTitleCounts).map((job_title) => ({
    job_title,
    count: jobTitleCounts[job_title],
  }));

  return c.json(result);
});

serve(app);
console.log('Hono API is running on http://localhost:3000');
