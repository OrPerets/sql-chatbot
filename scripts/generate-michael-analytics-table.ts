#!/usr/bin/env ts-node

/**
 * Generate a markdown table from Michael usage analytics JSON files
 */

import * as fs from 'fs';
import * as path from 'path';

interface PeriodData {
  period: {
    name: string;
    startDate: string;
    endDate: string;
  };
  analytics: {
    totalChatSessions: number;
    totalMessages: number;
    totalUsers: number;
    averageMessagesPerSession: number;
    averageMessagesPerUser: number;
    stdDevMessagesPerUser: number;
    stdDevMessagesPerSession: number;
  };
}

interface AllPeriodsData {
  exportInfo: {
    exportedAt: string;
    totalPeriods: number;
    periods: Array<{
      name: string;
      startDate: string;
      endDate: string;
    }>;
  };
  data: {
    [periodName: string]: PeriodData;
  };
}

function formatNumber(num: number, decimals: number = 2): string {
  if (num === 0 || isNaN(num)) return '0';
  return num.toFixed(decimals);
}

function generateMarkdownTable(data: AllPeriodsData): string {
  const periods = data.exportInfo.periods;
  
  let markdown = '# Michael Usage Analytics by Period\n\n';
  markdown += 'This table summarizes Michael usage statistics across different time periods.\n\n';
  markdown += '| Period | Number of Users | Number of Sessions | Total Messages | Avg Msg/User | Avg Msg/Session |\n';
  markdown += '|--------|----------------|-------------------|---------------|--------------|-----------------|\n';
  
  for (const period of periods) {
    const periodData = data.data[period.name];
    if (!periodData) {
      markdown += `| ${period.name} | 0 | 0 | 0 | 0 | 0 |\n`;
      continue;
    }
    
    const analytics = periodData.analytics;
    const avgMsgPerUser = formatNumber(analytics.averageMessagesPerUser || 0);
    const avgMsgPerSession = formatNumber(analytics.averageMessagesPerSession || 0);
    
    markdown += `| ${period.name} | `;
    markdown += `${analytics.totalUsers || 0} | `;
    markdown += `${analytics.totalChatSessions || 0} | `;
    markdown += `${analytics.totalMessages || 0} | `;
    markdown += `${avgMsgPerUser} | `;
    markdown += `${avgMsgPerSession} |\n`;
  }
  
  markdown += '\n';
  markdown += '## Notes\n\n';
  markdown += '- **Avg Msg/User**: Average number of messages per user\n';
  markdown += '- **Avg Msg/Session**: Average number of messages per session\n';
  markdown += `- Data exported on: ${new Date(data.exportInfo.exportedAt).toLocaleString()}\n`;
  
  return markdown;
}

async function main() {
  const jsonFilePath = path.join(process.cwd(), 'exports', 'michael-usage', 'michael-usage-all-periods.json');
  
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ File not found: ${jsonFilePath}`);
    console.error('Please run the export script first: npm run export:michael');
    process.exit(1);
  }
  
  console.log(`📖 Reading data from: ${jsonFilePath}`);
  
  try {
    const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
    const data: AllPeriodsData = JSON.parse(jsonContent);
    
    console.log(`✅ Loaded data for ${data.exportInfo.totalPeriods} periods`);
    
    const markdown = generateMarkdownTable(data);
    
    const outputPath = path.join(process.cwd(), 'exports', 'michael-usage', 'michael-analytics-table.md');
    fs.writeFileSync(outputPath, markdown, 'utf8');
    
    console.log(`\n✅ Markdown table generated successfully!`);
    console.log(`📄 Output file: ${outputPath}`);
    console.log('\n' + markdown);
    
  } catch (error) {
    console.error('❌ Error generating markdown table:', error);
    process.exit(1);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export { generateMarkdownTable };
