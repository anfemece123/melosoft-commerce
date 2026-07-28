import * as Yup from 'yup';
import {
  COLOMBIAN_CONTACT_PHONE_MESSAGE,
  COLOMBIAN_MOBILE_MESSAGE,
  PHONE_DIGITS_ONLY_MESSAGE,
  isValidColombianContactPhone,
  isValidColombianMobile,
} from '@/lib/phone/phoneValidation';

export const colombianMobilePhoneSchema = Yup.string()
  .trim()
  .matches(/^\d*$/, PHONE_DIGITS_ONLY_MESSAGE)
  .test(
    'valid-colombian-mobile',
    COLOMBIAN_MOBILE_MESSAGE,
    (value) => !value || isValidColombianMobile(value),
  );

export const colombianContactPhoneSchema = Yup.string()
  .trim()
  .matches(/^\d*$/, PHONE_DIGITS_ONLY_MESSAGE)
  .test(
    'valid-colombian-contact-phone',
    COLOMBIAN_CONTACT_PHONE_MESSAGE,
    (value) => !value || isValidColombianContactPhone(value),
  );
