declare const _default: () => {
    port: number;
    jwt: {
        secret: string;
        expiresIn: string;
    };
    database: {
        url: string | undefined;
    };
};
export default _default;
