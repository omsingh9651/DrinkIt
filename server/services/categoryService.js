import { categoryRepository } from '../repositories/categoryRepository.js';

export class CategoryService {
  async getAllCategories(options = {}) {
    return await categoryRepository.getAll(options);
  }

  async getCategoryById(id) {
    const category = await categoryRepository.getById(id);
    if (!category) {
      const err = new Error('Category not found.');
      err.statusCode = 404;
      throw err;
    }
    return category;
  }

  async getCategoryBySlug(slug) {
    const category = await categoryRepository.getBySlug(slug);
    if (!category) {
      const err = new Error('Category not found.');
      err.statusCode = 404;
      throw err;
    }
    return category;
  }

  async createCategory(data) {
    if (!data.name || !data.name.trim()) {
      const err = new Error('Category name is required.');
      err.statusCode = 400;
      throw err;
    }

    const slug = (data.slug || data.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check duplicate slug
    const existing = await categoryRepository.getBySlug(slug);
    if (existing) {
      const err = new Error(`Category with slug "${slug}" or name "${data.name}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    return await categoryRepository.create({
      ...data,
      slug,
      name: data.name.trim(),
    });
  }

  async updateCategory(id, data) {
    if (data.name !== undefined && !data.name.trim()) {
      const err = new Error('Category name cannot be empty.');
      err.statusCode = 400;
      throw err;
    }

    if (data.slug) {
      const existing = await categoryRepository.getBySlug(data.slug);
      if (existing && existing.id !== id) {
        const err = new Error(`Category with slug "${data.slug}" already exists.`);
        err.statusCode = 409;
        throw err;
      }
    }

    return await categoryRepository.update(id, data);
  }

  async deleteCategory(id) {
    return await categoryRepository.delete(id);
  }
}

export const categoryService = new CategoryService();
export default categoryService;

