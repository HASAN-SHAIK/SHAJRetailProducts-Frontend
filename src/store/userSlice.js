import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  userDetails: null,  // { id, user_name, email, role }
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserDetails: (state, action) => {
      state.userDetails = action.payload;
    },
    clearUserDetails: (state) => {
      state.userDetails = null;
    }
  }
});

export const { setUserDetails, clearUserDetails } = userSlice.actions;
export default userSlice.reducer;
