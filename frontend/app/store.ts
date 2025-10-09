import { Action, ThunkAction, configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "../src/api/apiSlice";
import authReducer from "../features/auth/authSlice";

export const store = configureStore({
  reducer: { [apiSlice.reducerPath]: apiSlice.reducer, auth: authReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
  devTools: true,
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>;
