
'use server';
// State type for server action validation
export type State = {
	message: string | null;
	errors: Record<string, string[]>;
};

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });


const CreateInvoice = z.object({
	customerId: z
		.string({ required_error: "Please select a customer", invalid_type_error: "Please select a customer" })
		.min(1, { message: "Please select a customer" }),
	amount: z.coerce.number().gt(0, { message: "Please enter an amount greater than 0$" }),
	status: z.enum(["pending", "paid"], { errorMap: () => ({ message: "Please select an invoice status" }) }),
});

export async function updateInvoice(
	id: string,
	prevState: State,
	formData: FormData
): Promise<State> {
	const raw = {
		customerId: formData.get('customerId'),
		amount: formData.get('amount'),
		status: formData.get('status'),
	};
	const result = CreateInvoice.safeParse(raw);
	if (!result.success) {
		const errors: Record<string, string[]> = {};
		let missingFields = false;
		for (const issue of result.error.issues) {
			const key = issue.path[0] as string;
			if (!errors[key]) errors[key] = [];
			errors[key].push(issue.message);
			if (issue.code === 'invalid_type' || issue.code === 'too_small' || issue.code === 'invalid_enum_value') {
				missingFields = true;
			}
		}
		return {
			message: missingFields ? "Missing Fields. Failed to Update Invoice." : "Failed to Update Invoice.",
			errors,
		};
	}
	const { customerId, amount, status } = result.data;
	const amountInCents = amount * 100;
	try {
		await sql`
			UPDATE invoices
			SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
			WHERE id = ${id}
		`;
	} catch (error) {
		console.error(error);
		return { message: 'Database Error: Failed to Update Invoice.', errors: {} };
	}
	revalidatePath('/dashboard/invoices');
	redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
	try {
		await sql`DELETE FROM invoices WHERE id = ${id}`;
	} catch (error) {
		console.error(error);
		throw new Error('Database Error: Failed to Delete Invoice.');
	}
	revalidatePath('/dashboard/invoices');
	redirect('/dashboard/invoices');
}
export async function createInvoice(
	prevState: State,
	formData: FormData
): Promise<State> {
	const raw = {
		customerId: formData.get('customerId'),
		amount: formData.get('amount'),
		status: formData.get('status'),
	};
		const result = CreateInvoice.safeParse(raw);
		if (!result.success) {
			// Map Zod errors to field errors
			const errors: Record<string, string[]> = {};
			let missingFields = false;
			for (const issue of result.error.issues) {
				const key = issue.path[0] as string;
				if (!errors[key]) errors[key] = [];
				errors[key].push(issue.message);
				if (issue.code === 'invalid_type' || issue.code === 'too_small' || issue.code === 'invalid_enum_value') {
					missingFields = true;
				}
			}
			return {
				message: missingFields ? "Missing Fields" : "Failed to create Invoice",
				errors,
			};
		}
	const { customerId, amount, status } = result.data;
	const amountInCents = amount * 100;
	const date = new Date().toISOString().split('T')[0];
		try {
			await sql`
				INSERT INTO invoices (customer_id, amount, status, date)
				VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
			`;
		} catch (error) {
			console.error(error);
			return {
				message: 'Failed to create Invoice',
				errors: {},
			};
		}
	revalidatePath('/dashboard/invoices');
	redirect('/dashboard/invoices');
}
