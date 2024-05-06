import { OrderStatus } from "@prisma/client";

export interface OrderWithProducts {
    OrderItem: {
        name: any;
        productId: number;
        quantity: number;
        price: number;
    }[];
    id: string;
    totalAmount: number;
    totalItem: number;
    status: OrderStatus;
    paid: boolean;
    paidAt: Date;
    createdAt: Date;
    updatedAt: Date;
}