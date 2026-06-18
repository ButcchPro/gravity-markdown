import mammoth from 'mammoth';
import TurndownService from 'turndown';
import fs from 'fs/promises';

async function test() {
  const buffer = await fs.readFile('test.docx');
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;
  
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(html);
  
  console.log('Markdown Output:');
  console.log(markdown);
}
test().catch(console.error);