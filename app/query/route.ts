import postgres from 'postgres';
import { NextResponse } from 'next/server';

// Use Node runtime because the native postgres client requires Node APIs
export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL ?? '', { ssl: 'require' });

async function listInvoices() {
  const data = await sql`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;

  return data;
}

export async function GET() {
  try {
    const invoices = await listInvoices();
    return NextResponse.json(invoices);
  } catch (error) {
    console.error('GET /query error', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
