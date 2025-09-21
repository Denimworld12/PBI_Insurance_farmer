const jsPDF = require('jspdf');
const path = require('path');
const fs = require('fs');

/**
 * Document Generator Utility
 * Generates PDF reports and documents for claims
 */

/**
 * Generate claim report PDF
 * @param {Object} claimData - Claim data object
 * @returns {Buffer} PDF buffer
 */
const generateClaimPDF = (claimData) => {
  try {
    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.text('PBI Agriculture Insurance', 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(16);
    doc.text('Claim Assessment Report', 105, y, { align: 'center' });
    y += 20;

    // Document details
    doc.setFontSize(12);
    doc.text(`Document ID: ${claimData.documentId}`, 14, y); y += 8;
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, y); y += 8;
    doc.text(`Status: ${claimData.status?.toUpperCase()}`, 14, y); y += 15;

    // Farmer details
    doc.setFontSize(14);
    doc.text('Farmer Details:', 14, y); y += 10;
    doc.setFontSize(10);
    doc.text(`Phone: ${claimData.user?.phoneNumber || 'N/A'}`, 14, y); y += 6;
    doc.text(`Insurance Type: ${claimData.insurance?.name || 'N/A'}`, 14, y); y += 6;
    doc.text(`Policy Number: ${claimData.formData?.insuranceNumber || 'N/A'}`, 14, y); y += 15;

    // Claim details
    doc.setFontSize(14);
    doc.text('Claim Details:', 14, y); y += 10;
    doc.setFontSize(10);
    
    const claimDetails = [
      `State: ${claimData.formData?.state}`,
      `Season: ${claimData.formData?.season}`,
      `Year: ${claimData.formData?.year}`,
      `Crop Type: ${claimData.formData?.cropType}`,
      `Farm Area: ${claimData.formData?.farmArea} acres`,
      `Loss Reason: ${claimData.formData?.lossReason}`,
      `Submitted: ${claimData.submittedAt ? new Date(claimData.submittedAt).toLocaleDateString('en-IN') : 'N/A'}`
    ];

    claimDetails.forEach(detail => {
      doc.text(detail, 14, y);
      y += 6;
    });

    y += 10;

    // Processing results
    if (claimData.processingResult) {
      doc.setFontSize(14);
      doc.text('Assessment Results:', 14, y); y += 10;
      doc.setFontSize(10);

      const results = [
        `Risk Level: ${claimData.processingResult.risk?.toUpperCase()}`,
        `Verification Level: ${claimData.processingResult.verificationLevel?.replace('-', ' ').toUpperCase()}`,
        `Physical Check Required: ${claimData.processingResult.needPhysicalCheck ? 'Yes' : 'No'}`,
        `Estimated Damage: ${claimData.processingResult.phases?.damageAssessment?.percentage?.toFixed(2) || 0}%`
      ];

      results.forEach(result => {
        doc.text(result, 14, y);
        y += 6;
      });

      y += 10;
    }

    // Financial details
    if (claimData.financial) {
      doc.setFontSize(14);
      doc.text('Financial Details:', 14, y); y += 10;
      doc.setFontSize(10);

      if (claimData.financial.claimedAmount) {
        doc.text(`Claimed Amount: ₹${claimData.financial.claimedAmount.toLocaleString('en-IN')}`, 14, y); y += 6;
      }
      if (claimData.financial.assessedAmount) {
        doc.text(`Assessed Amount: ₹${claimData.financial.assessedAmount.toLocaleString('en-IN')}`, 14, y); y += 6;
      }
      if (claimData.financial.approvedAmount) {
        doc.text(`Approved Amount: ₹${claimData.financial.approvedAmount.toLocaleString('en-IN')}`, 14, y); y += 6;
      }

      y += 10;
    }

    // Media summary
    if (claimData.media) {
      doc.setFontSize(14);
      doc.text('Evidence Submitted:', 14, y); y += 10;
      doc.setFontSize(10);

      const mediaCount = {
        photos: (claimData.media.cornerPhotos?.length || 0) + (claimData.media.damagedCropPhoto ? 1 : 0),
        videos: claimData.media.farmVideo ? 1 : 0
      };

      doc.text(`Photos: ${mediaCount.photos}`, 14, y); y += 6;
      doc.text(`Videos: ${mediaCount.videos}`, 14, y); y += 15;
    }

    // Footer
    y = 280; // Near bottom
    doc.setFontSize(8);
    doc.text('This is a computer-generated document and does not require signature.', 14, y);
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')} by PBI AgriInsure System`, 14, y + 5);

    return Buffer.from(doc.output('arraybuffer'));

  } catch (error) {
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

/**
 * Generate document ID
 * @returns {string} Unique document ID (8 digits + 2 letters)
 */
const generateDocumentId = () => {
  const numbers = Math.floor(10000000 + Math.random() * 90000000);
  const letters = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${numbers}${letters}`;
};

/**
 * Save PDF to file
 * @param {Buffer} pdfBuffer - PDF buffer data
 * @param {string} filename - Output filename
 * @param {string} directory - Output directory (optional)
 * @returns {string} File path
 */
const savePDFToFile = (pdfBuffer, filename, directory = 'reports') => {
  try {
    // Ensure directory exists
    const outputDir = path.join(process.cwd(), directory);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, pdfBuffer);
    
    return filePath;
  } catch (error) {
    throw new Error(`Failed to save PDF: ${error.message}`);
  }
};

module.exports = {
  generateClaimPDF,
  generateDocumentId,
  savePDFToFile
};
