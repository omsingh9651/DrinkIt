import { Router } from 'express';
import { userRepository } from '../repositories/userRepository.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';

const router = Router();

// Protect all /api/users routes with verified customer JWT
router.use(requireCustomerAuth);

/**
 * GET /api/users/me
 * Fetch customer profile
 */
router.get('/me', async (req, res) => {
  try {
    const phone = req.user.phone;

    const profile = await userRepository.getByPhone(phone);

    return res.json({
      success: true,
      user: profile,
    });
  } catch (err) {
    console.error('Fetch profile error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch customer profile.' });
  }
});

/**
 * PUT /api/users/me
 * Update customer profile
 */
router.put('/me', async (req, res) => {
  try {
    const phone = req.user.phone;
    const updated = await userRepository.upsertProfile(phone, req.body);

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updated,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update customer profile.' });
  }
});

/**
 * GET /api/users/me/addresses
 */
router.get('/me/addresses', async (req, res) => {
  try {
    const phone = req.user.phone;
    const addresses = await userRepository.getAddresses(phone);
    return res.json({
      success: true,
      addresses,
    });
  } catch (err) {
    console.error('Fetch addresses error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve addresses.' });
  }
});

/**
 * POST /api/users/me/addresses
 */
router.post('/me/addresses', async (req, res) => {
  try {
    const phone = req.user.phone;
    const newAddress = await userRepository.addAddress(phone, req.body);

    return res.status(201).json({
      success: true,
      address: newAddress,
    });
  } catch (err) {
    console.error('Add address error:', err);
    return res.status(500).json({ success: false, error: 'Failed to save address.' });
  }
});

/**
 * DELETE /api/users/me/addresses/:id
 */
router.delete('/me/addresses/:id', async (req, res) => {
  try {
    const phone = req.user.phone;
    await userRepository.deleteAddress(phone, req.params.id);

    return res.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (err) {
    console.error('Delete address error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete address.' });
  }
});

export default router;
