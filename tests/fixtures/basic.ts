const level = 'root'
export const topVar = 'foo'

class topClass {}

function topFn() {}

export const topFoo = () => {
  console.log(level)
}

{
  const level = '2'
  class Level2Class {
    //
  }

  {
    const level = '3'
    function Level3Fn() {
      //
    }
  }

  // Level 2
}

// Level 1
