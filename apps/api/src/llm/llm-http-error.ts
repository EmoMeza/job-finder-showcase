import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  type HttpException,
} from '@nestjs/common';
import { LlmError } from './llm.types.js';

/** Traduce un error de IA a una respuesta HTTP: 400 si lo resuelve el usuario, 502/504 si no. */
export function toHttpException(error: unknown): unknown {
  if (!(error instanceof LlmError)) return error;
  const map: Record<LlmError['code'], (message: string) => HttpException> = {
    not_configured: (m) => new BadRequestException(m),
    invalid_credentials: (m) => new BadRequestException(m),
    timeout: (m) => new GatewayTimeoutException(m),
    rate_limited: (m) => new BadGatewayException(m),
    refused: (m) => new BadGatewayException(m),
    invalid_output: (m) => new BadGatewayException(m),
    unavailable: (m) => new BadGatewayException(m),
  };
  return map[error.code](error.message);
}
