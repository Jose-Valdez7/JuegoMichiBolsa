import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument = require('pdfkit');

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  async generateCertificate(userId: number): Promise<Buffer> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(24).text('Certificado de Participación', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`Se certifica que ${user.name} participó en "El Juego de la Bolsa".`, {
        align: 'center',
      });
      doc.moveDown(2);
      const date = new Date().toLocaleDateString();
      doc.text(`Fecha: ${date}`, { align: 'center' });
      doc.end();
    });
  }
}
