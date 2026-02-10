import {jwtDecode} from 'jwt-decode';
import Cookies from 'js-cookie';

export const getUserRole = () => {
  const token = Cookies.get('token');
  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    return decoded || null;
  } catch (err) {
    console.error('Invalid token', err);
    return null;
  }
};