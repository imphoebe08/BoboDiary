import { Client } from '@notionhq/client';
import 'dotenv/config';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  const { method } = req;

  try {
    // 新增行程
    if (method === 'POST') {
      const { title, date } = req.body;
      if (!title || !date) {
        return res.status(400).json({ error: 'Title and date are required.' });
      }

      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          'Name': { title: [{ text: { content: title } }] },
          'Date': { date: { start: date } },
        },
      });
      return res.status(201).json(response);
    }

    // 編輯行程
    if (method === 'PATCH') {
      const { page_id } = req.query; // 改由 query 字串接收 ID
      const { title, date } = req.body || {};
      const properties = {};
      if (title) properties['Name'] = { title: [{ text: { content: title } }] };
      if (date) properties['Date'] = { date: { start: date } };
      const response = await notion.pages.update({ page_id, properties });
      return res.status(200).json(response);
    }

    // 刪除行程
    if (method === 'DELETE') {
      const { page_id } = req.query; // 改由 query 字串接收 ID
      const response = await notion.pages.update({ page_id, archived: true });
      return res.status(200).json(response);
    }

    res.setHeader('Allow', ['POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  } catch (error) {
    console.error('Notion API Error:', error.body || error);
    return res.status(500).json({ error: 'Failed to communicate with Notion.' });
  }
}