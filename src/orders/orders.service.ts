import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { ChangeOrderStatusDto, OrderPaginationDto } from './dto';
import { PRODUCT_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrdersService')

  constructor(@Inject(PRODUCT_SERVICE) private readonly productsClient: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async create(createOrderDto: CreateOrderDto) {

    try {

      const productsIds = createOrderDto.itmes.map(item => item.productId);

      const products: any[] = await firstValueFrom(
        this.productsClient.send({ cmd: 'validate_products' }, productsIds)
      );

      const totalAmount = createOrderDto.itmes.reduce((acc, orderItem) => {
        const price = products.find(product => product.id === orderItem.productId).price;
        return price * orderItem.quantity;
      }, 0);

      const totalItem = createOrderDto.itmes.reduce((acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0)

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItem,
          OrderItem: {
            createMany: {
              data: createOrderDto.itmes.map(orderItem => ({
                price: products.find(product => product.id === orderItem.productId).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      })

      return { ...order, OrderItem: order.OrderItem.map(item => ({ ...item, name: products.find(product => product.id === item.productId).name })) };

    } catch (error) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'One or more products not found, check logs'
      });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDto.status
      }
    });

    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDto.status
        }
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages / perPage)
      }
    }
  }

  async findOne(id: string) {

    const order = await this.order.findFirst({
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true
          }
        }
      }
    });

    if (!order) throw new RpcException({ status: HttpStatus.NOT_FOUND, message: 'Order not found' });

    const productsIds = order.OrderItem.map(item => item.productId);
    const products: any[] = await firstValueFrom(
      this.productsClient.send({ cmd: 'validate_products' }, productsIds)
    );

    return { ...order, OrderItem: order.OrderItem.map(item => ({ ...item, name: products.find(product => product.id === item.productId).name })) };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);

    if (order.status === status)
      return order;

    return this.order.update({ where: { id }, data: { status } })
  }

}
