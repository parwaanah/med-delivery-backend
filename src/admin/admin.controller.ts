import { 
  Controller, 
  Post, 
  Patch, 
  Body, 
  Param, 
  Get, 
  UseGuards 
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// ✅ Import DTOs (ensure these files exist)
import { CreatePharmacyDto } from './dto/create-pharmacy.dto';
import { AddMedicineDto } from './dto/add-medicine.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ✅ Create new pharmacy
  @Post('pharmacy')
  @Roles('admin')
  async createPharmacy(@Body() dto: CreatePharmacyDto) {
    return this.adminService.createPharmacy(dto.name, dto.address, dto.phone);
  }

  // ✅ Add medicine to pharmacy
  @Post('medicine')
  @Roles('admin')
  async addMedicine(@Body() dto: AddMedicineDto) {
    return this.adminService.addMedicine(dto.pharmacyId, dto.name, dto.price, dto.stock);
  }

  // ✅ Update medicine stock
  @Patch('medicine/:id/stock')
  @Roles('admin')
  async updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.adminService.updateMedicineStock(Number(id), dto.stock);
  }

  // ✅ Fetch all orders (admin view)
  @Get('orders')
  @Roles('admin')
  async getAllOrders() {
    return this.adminService.getAllOrders();
  }

  // ✅ Update order status
  @Patch('orders/:id/status')
  @Roles('admin')
  async updateOrderStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.adminService.updateOrderStatus(Number(id), dto.status);
  }
}
