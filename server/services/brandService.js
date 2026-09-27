import { brandRepository } from '../repositories/brandRepository.js';

export class BrandService {
  async getAllBrands(options = {}) {
    return await brandRepository.getAll(options);
  }

  async getBrandById(id) {
    const brand = await brandRepository.getById(id);
    if (!brand) {
      const err = new Error('Brand not found.');
      err.statusCode = 404;
      throw err;
    }
    return brand;
  }

  async getBrandBySlug(slug) {
    const brand = await brandRepository.getBySlug(slug);
    if (!brand) {
      const err = new Error('Brand not found.');
      err.statusCode = 404;
      throw err;
    }
    return brand;
  }

  async createBrand(data) {
    if (!data.name || !data.name.trim()) {
      const err = new Error('Brand name is required.');
      err.statusCode = 400;
      throw err;
    }

    const slug = (data.slug || data.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = await brandRepository.getBySlug(slug);
    if (existing) {
      const err = new Error(`Brand with slug "${slug}" or name "${data.name}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    return await brandRepository.create({
      ...data,
      name: data.name.trim(),
      slug,
    });
  }

  async updateBrand(id, data) {
    if (data.name !== undefined && !data.name.trim()) {
      const err = new Error('Brand name cannot be empty.');
      err.statusCode = 400;
      throw err;
    }

    if (data.slug) {
      const existing = await brandRepository.getBySlug(data.slug);
      if (existing && existing.id !== id) {
        const err = new Error(`Brand with slug "${data.slug}" already exists.`);
        err.statusCode = 409;
        throw err;
      }
    }

    return await brandRepository.update(id, data);
  }

  async deleteBrand(id) {
    return await brandRepository.delete(id);
  }
}

export const brandService = new BrandService();
export default brandService;

