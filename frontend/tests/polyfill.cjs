if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Iterator !== 'undefined' && !Iterator.prototype.find) {
  Iterator.prototype.find = function (predicate) {
    let index = 0;
    for (const value of this) {
      if (predicate(value, index++)) {
        return value;
      }
    }
    return undefined;
  };
}
