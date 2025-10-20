import { Controller, Get, Header, Param, ParseIntPipe, Res, UseGuards } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('certificate')
export class CertificatesController {
  constructor(private certs: CertificatesService) {}

  @Get(':id')
  @Header('Content-Type', 'application/pdf')
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdf = await this.certs.generateCertificate(id);
    res.setHeader('Content-Disposition', `attachment; filename=certificado-${id}.pdf`);
    return res.send(pdf);
  }
}
