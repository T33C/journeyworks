/**
 * Customers Controller
 *
 * REST API endpoints for customer operations.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  SearchCustomersDto,
  CustomerResponseDto,
  PaginatedCustomersDto,
  CustomerStatsDto,
} from './dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({
    status: 201,
    description: 'Customer created successfully',
    type: CustomerResponseDto,
  })
  async create(@Body() dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    return this.service.create(dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search customers' })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: PaginatedCustomersDto,
  })
  async search(
    @Query() dto: SearchCustomersDto,
  ): Promise<PaginatedCustomersDto> {
    return this.service.search(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get customer statistics' })
  @ApiResponse({
    status: 200,
    description: 'Customer statistics',
    type: CustomerStatsDto,
  })
  async getStats(): Promise<CustomerStatsDto> {
    return this.service.getStats();
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Get customer health analysis' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: 200,
    description: 'Customer health analysis',
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getHealth(@Param('id') id: string): Promise<{
    customerId: string;
    healthScore: number;
    trend: 'improving' | 'stable' | 'declining';
    riskFactors: string[];
    recommendations: string[];
  }> {
    return this.service.getHealth(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: 200,
    description: 'Customer found',
    type: CustomerResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findById(@Param('id') id: string): Promise<CustomerResponseDto> {
    return this.service.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: 200,
    description: 'Customer updated',
    type: CustomerResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ status: 204, description: 'Customer deleted' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create customers' })
  @ApiResponse({
    status: 201,
    description: 'Customers created',
  })
  async bulkCreate(
    @Body() dtos: CreateCustomerDto[],
  ): Promise<{ created: number; failed: number }> {
    return this.service.bulkCreate(dtos);
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  @ApiResponse({
    status: 200,
    description: 'All customers',
    type: [CustomerResponseDto],
  })
  async getAll(): Promise<CustomerResponseDto[]> {
    return this.service.getAll();
  }
}
