export const getToken = (): string | null => {
    return localStorage.getItem('cricked_token')
}

export const setToken = (token: string): void => {
    localStorage.setItem('cricked_token', token)
}

export const removeToken = (): void => {
    localStorage.removeItem('cricked_token')
}

export const isLoggedIn = (): boolean => {
    return !!getToken()
}