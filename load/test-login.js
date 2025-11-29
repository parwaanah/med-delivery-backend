import http from "k6/http";
import { check } from "k6";

export let options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const res = http.post(
    "http://localhost:3001/auth/login",
    JSON.stringify({
      email: "loadtest@example.com",
      password: "123456",
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  check(res, {
    "login 201": (r) => r.status === 201,
  });

  console.log("STATUS:", res.status);
  console.log("BODY:", res.body);
}
