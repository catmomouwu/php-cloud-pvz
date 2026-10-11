// better-auth 的全部端点（/api/auth/sign-up/email、/api/auth/sign-in/email、/api/auth/get-session …）
export default defineEventHandler(async (event) => {
  const auth = await useAuth(event)
  return auth.handler(toWebRequest(event))
})
