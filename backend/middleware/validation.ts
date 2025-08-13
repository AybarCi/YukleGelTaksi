import * as Joi from 'joi';
import { NextRequest, NextResponse } from 'next/server';

// Kullanıcı kayıt validasyonu
export const userRegistrationSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+90[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Geçerli bir Türkiye telefon numarası girin (+905XXXXXXXXX)',
      'any.required': 'Telefon numarası gerekli'
    }),
  firstName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Ad en az 2 karakter olmalı',
      'string.max': 'Ad en fazla 50 karakter olmalı',
      'any.required': 'Ad gerekli'
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Soyad en az 2 karakter olmalı',
      'string.max': 'Soyad en fazla 50 karakter olmalı',
      'any.required': 'Soyad gerekli'
    }),
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Geçerli bir email adresi girin'
    })
});

// SMS doğrulama kodu validasyonu
export const verificationCodeSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+90[0-9]{10}$/)
    .required(),
  code: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.length': 'Doğrulama kodu 6 haneli olmalı',
      'string.pattern.base': 'Doğrulama kodu sadece rakamlardan oluşmalı'
    })
});

// Refresh token validasyonu
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token gerekli'
    })
});

// Yolculuk oluşturma validasyonu
export const tripCreationSchema = Joi.object({
  pickupAddress: Joi.string().min(10).max(200).required(),
  pickupLatitude: Joi.number().min(-90).max(90).required(),
  pickupLongitude: Joi.number().min(-180).max(180).required(),
  destinationAddress: Joi.string().min(10).max(200).required(),
  destinationLatitude: Joi.number().min(-90).max(90).required(),
  destinationLongitude: Joi.number().min(-180).max(180).required(),
  paymentMethod: Joi.string().valid('cash', 'card', 'wallet').required()
});

// Kullanıcı profil güncelleme validasyonu
export const userUpdateSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional()
});

// Adres ekleme validasyonu
export const addressSchema = Joi.object({
  addressType: Joi.string().valid('home', 'work', 'other').required(),
  title: Joi.string().min(2).max(50).required(),
  addressLine: Joi.string().min(10).max(200).required(),
  city: Joi.string().min(2).max(50).required(),
  district: Joi.string().min(2).max(50).required(),
  postalCode: Joi.string().length(5).pattern(/^[0-9]+$/).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  isDefault: Joi.boolean().optional()
});

// Değerlendirme validasyonu
export const ratingSchema = Joi.object({
  tripId: Joi.number().integer().positive().required(),
  userRating: Joi.number().integer().min(1).max(5).required(),
  userComment: Joi.string().max(500).optional()
});

// Validation middleware fonksiyonu
export async function validateRequest(request: NextRequest, schema: Joi.ObjectSchema) {
  try {
    const body = await request.json();
    const { error, value } = schema.validate(body, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map((detail: any) => detail.message);
      return {
        isValid: false,
        errors: errorMessages,
        data: null
      };
    }
    
    return {
      isValid: true,
      errors: null,
      data: value
    };
  } catch (error) {
    return {
      isValid: false,
      errors: ['Geçersiz JSON formatı'],
      data: null
    };
  }
}

// Telefon numarası formatını düzenle
export function formatPhoneNumber(phone: string): string {
  // +90 ile başlamıyorsa ekle
  if (!phone.startsWith('+90')) {
    // 0 ile başlıyorsa kaldır
    if (phone.startsWith('0')) {
      phone = phone.substring(1);
    }
    phone = '+90' + phone;
  }
  return phone;
}

// Email validasyonu
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Güçlü şifre kontrolü
export function isStrongPassword(password: string): boolean {
  // En az 8 karakter, en az 1 büyük harf, 1 küçük harf, 1 rakam
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}