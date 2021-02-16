# crestron-cip
Node js module for Crestron CIP interconnection


## Installation

```sh
npm install --save crestron-cip
```

## Usage

```js
import cipclient from  'crestron-cip'

const  cip  = cipclient.connect({host:  "192.168.0.100",  ipid:  "\x03"},  ()  =>  {
  console.log('CIP connected')
  cip.dset(101, 1) // set digital value
  console.log("digital value: " + cip.dget(101))
  cip.aset(102, 25163) //set analog value
  console.log("analog value: " +  cip.aget(102))
})

cip.subscribe((data)  =>  {
  console.log("type:"  +  data.type  +  " join:"  +  data.join  +  " value:"  +  data.value)
})
```
