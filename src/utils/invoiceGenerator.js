const db = require('../config/database');

const generateInvoiceNumber = async (ownerId, outletCode) => {
  try {

    const [results] = await db.query(
      `
      SELECT prefix, last_number 
      FROM invoice_settings 
      WHERE owner_id = ?
      `,
      [ownerId]
    );

    if (!results.length) {
      throw new Error('Invoice setting not found');
    }

    const { prefix, last_number } = results[0];

    const newNumber = last_number + 1;

    await db.query(
      `
      UPDATE invoice_settings 
      SET last_number = ? 
      WHERE owner_id = ?
      `,
      [newNumber, ownerId]
    );

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear()).slice(-2);

    const datePart = `${day}${month}${year}`;
    const numberPart = String(newNumber).padStart(7, '0');

    return `${prefix}-${outletCode}-${datePart}-${numberPart}`;

  } catch (error) {
    throw error;
  }
};

module.exports = generateInvoiceNumber;