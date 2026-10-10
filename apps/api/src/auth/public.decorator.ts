import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca un controller o endpoint como accesible sin sesión. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
