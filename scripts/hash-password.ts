import * as bcrypt from 'bcrypt';

(async () => {
  const plain = "SuperAdmin@123";
  const hash = await bcrypt.hash(plain, 10);
  console.log("HASH:", hash);
})();
