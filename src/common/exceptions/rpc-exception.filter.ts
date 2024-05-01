import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter {

    catch(exception: RpcException, host: ArgumentsHost) {

        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const rpxError = exception.getError();

        if (typeof rpxError === 'object' && 'status' in rpxError && 'message' in rpxError) {
            const status = isNaN(+rpxError.status) ? 400 : +rpxError.status;
            return response.status(status).json(rpxError);
        }

        response.status(400).json({
            status: 400,
            message: rpxError
        });

    }

}