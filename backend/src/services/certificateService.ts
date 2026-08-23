import PDFDocument from 'pdfkit';

// Diploma palette
const NAVY = '#152642';
const GOLD = '#b08d33';
const CREAM = '#fbf8f1';
const MUTED = '#6b7280';

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    return typeof date === 'string' ? date : d.toISOString();
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Renders a diamond ornament centered on (x, y).
 */
function drawCornerOrnament(doc: PDFKit.PDFDocument, x: number, y: number): void {
  doc.save();
  doc.translate(x, y).rotate(45);
  doc.rect(-5, -5, 10, 10).fill(GOLD);
  doc.restore();
}

/**
 * Draws a labeled "signature line" — a value sitting above a rule, with a
 * caption underneath — used for the issue date and the verification credit.
 */
function drawSignatureLine(
  doc: PDFKit.PDFDocument,
  x: number,
  lineY: number,
  width: number,
  value: string,
  caption: string,
  align: 'left' | 'right'
): void {
  doc
    .fillColor(NAVY)
    .font('Times-Italic')
    .fontSize(13)
    .text(value, x, lineY - 22, { width, align });

  doc
    .moveTo(x, lineY)
    .lineTo(x + width, lineY)
    .lineWidth(0.75)
    .strokeColor(NAVY)
    .stroke();

  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text(caption.toUpperCase(), x, lineY + 6, { width, align, characterSpacing: 0.5 });
}

/**
 * Generates a landscape A4 PDF diploma for a completed course and returns it
 * as an in-memory Buffer (nothing is written to disk).
 *
 * @param studentName the name to print on the certificate
 * @param courseTitle the completed course/roadmap title
 * @param sha256Hash  the certificate's verification hash (printed at the foot
 *                     of the page so anyone holding the PDF can verify it via
 *                     GET /api/certificates/verify/:hash)
 * @param date         the issue date
 */
export function generateCertificatePDF(
  studentName: string,
  courseTitle: string,
  sha256Hash: string,
  date: Date | string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
        info: {
          Title: `Certificate of Completion - ${courseTitle}`,
          Author: 'EdLearn',
          Subject: `Awarded to ${studentName}`
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { width, height } = doc.page;

      // Background
      doc.rect(0, 0, width, height).fill(CREAM);

      // Outer + inner border
      const outerMargin = 24;
      const innerMargin = 34;
      doc
        .lineWidth(2)
        .strokeColor(NAVY)
        .rect(outerMargin, outerMargin, width - outerMargin * 2, height - outerMargin * 2)
        .stroke();
      doc
        .lineWidth(1)
        .strokeColor(GOLD)
        .rect(innerMargin, innerMargin, width - innerMargin * 2, height - innerMargin * 2)
        .stroke();

      // Corner ornaments
      drawCornerOrnament(doc, innerMargin, innerMargin);
      drawCornerOrnament(doc, width - innerMargin, innerMargin);
      drawCornerOrnament(doc, innerMargin, height - innerMargin);
      drawCornerOrnament(doc, width - innerMargin, height - innerMargin);

      // Header
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(12)
        .text('EDLEARN', 0, 78, { align: 'center', characterSpacing: 4 });

      doc
        .fillColor(NAVY)
        .font('Times-Bold')
        .fontSize(38)
        .text('Certificate of Completion', 0, 102, { align: 'center' });

      // Gold divider under the title
      const dividerWidth = 140;
      doc
        .moveTo(width / 2 - dividerWidth / 2, 162)
        .lineTo(width / 2 + dividerWidth / 2, 162)
        .lineWidth(1.5)
        .strokeColor(GOLD)
        .stroke();

      // Body copy
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(13)
        .text('This certifies that', 0, 196, { align: 'center' });

      doc
        .fillColor(NAVY)
        .font('Times-BoldItalic')
        .fontSize(32)
        .text(studentName, 60, 222, { align: 'center', width: width - 120 });

      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(13)
        .text('has successfully completed the course', 0, 274, { align: 'center' });

      doc
        .fillColor(NAVY)
        .font('Times-Bold')
        .fontSize(24)
        .text(courseTitle, 80, 300, { align: 'center', width: width - 160 });

      // Signature-style lines: issue date (left) and verified credential (right)
      const lineY = height - 130;
      const lineWidthPx = 200;
      drawSignatureLine(doc, innerMargin + 60, lineY, lineWidthPx, formatDate(date), 'Date Issued', 'left');
      drawSignatureLine(
        doc,
        width - innerMargin - 60 - lineWidthPx,
        lineY,
        lineWidthPx,
        'EdLearn Platform',
        'Verified Credential',
        'right'
      );

      // SHA-256 verification hash, footer
      doc
        .fillColor(MUTED)
        .font('Courier')
        .fontSize(8)
        .text(`SHA-256 VERIFICATION HASH   ${sha256Hash}`, innerMargin + 20, height - 46, {
          align: 'center',
          width: width - (innerMargin + 20) * 2
        });

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export default generateCertificatePDF;
