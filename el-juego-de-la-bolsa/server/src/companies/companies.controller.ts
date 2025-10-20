import { Controller, Get } from '@nestjs/common';
import { CompaniesService } from './companies.service';

@Controller('api/companies')
export class CompaniesController {
  constructor(private companies: CompaniesService) {}

  @Get()
  async findAll() {
    return this.companies.findAll();
  }
}
