const level = 'root'

for (const iterator of object) {
  console.log(iterator)
}

for (const key in object) {
  console.log(key)
}

for (let i = 0; i < array.length; i++) {
  console.log(i)
}

while (1) {
  console.log(level)
}

do {
  console.log(level)
} while (1)
;[].forEach((item, idx) => {
  console.log(item, idx)
})

console.log(level)
