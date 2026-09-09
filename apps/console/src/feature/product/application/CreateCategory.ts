import type { ProductCommand, ProductPort } from '../public';

export class CreateCategory {
  constructor(private readonly port: Pick<ProductPort, 'createCategory'>) {}

  execute(request: ProductCommand, input: Readonly<{ name: string; parent: string | null; sort: number }>) {
    return this.port.createCategory(request, input);
  }
}
