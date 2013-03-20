## Kamino.js

> _Kamino (pronounced /kə'minoʊ/), called Planet of Storms, was the
> watery world where the Clone Army for the Galactic Republic was created,
> as well as the Kamino Home Fleet. It was inhabited by a race of tall,
> elegant beings called the Kaminoans, who kept to themselves and were
> known for their cloning technology._
> 
> —[Wookiepedia](http://starwars.wikia.com/wiki/Kamino)

Kamino.js is a library for passing data structures between sandboxed
environments in the browser via `postMessage`. While newer browsers
implement this automatically, older browsers only allow string
arguments. Kamino.js serializes JavaScript data structures into a string
that can be reconstituted on the other side.

In keeping with the Unix philosophy, it is a modular library that does
one thing and does it well.

_"Why not just use JSON.stringify and JSON.parse?,"_ I hear you asking.
Great question.

Kamino.js implements the [_structured clone algorithm_ described in the
HTML5
specification](http://www.w3.org/TR/html5/common-dom-interfaces.html#safe-passing-of-structured-data).
The structured clone algorithm supports more complicated data structures
than the limited subset JSON does. (See _Differences from JSON_, below.)

Within the constraints of what's possible with
JavaScript (see _Limitations_, below), you will get the same results
with Kamino.js as you would by using the built-in structured clone
behavior in newer browsers.

This means you can feel free to pass objects as rich as you'd like, and
not be limited to the restricted subset JSON allows.

### Usage

Kamino.js works just like `JSON`. To create a string representation of
an object, call `Kamino.stringify`:

```javascript
var message = {
  name: 'authorAdded',
  data: {
    name: "Yehuda Katz",
    age: 30
  }
};

var serialized = Kamino.stringify(message);
window.parent.postMessage(serialized, '*');
```

On the receiving end, deserialize using `Kamino.parse`:

```javascript
window.addEventListener('message', function(event) {
  var message = Kamino.parse(event.data);

  var name = message.name;
  var data = message.data;

  console.log('Got message ' + name + ' with data ', data);
});
```

If you're not crossing memory boundaries, Kamino.js includes a shorthand
for creating a structured clone:

```javascript
var clone = Kamino.clone(object);
```

Note that this is just shorthand for:

```javascript
Kamino.parse(Kamino.stringify(object));
```

Because it involves a serialization/deserialization roundtrip, there are
probably more memory- and CPU-efficient ways to create clones in the
same memory space.

### Differences from JSON

#### Additional Primitive Support

JSON supports a very narrow subset of primitive types: strings, numbers,
`null`, arrays, and objects. If you try to serialize other types, they
will be converted to `null` (like `Infinity` or `NaN`) or to a string
(`Date`s) that must be manually deserialized on the other side.

In addition to the types supported by JSON, Kamino.js supports:

* `Infinity`
* `-Infinity`
* `NaN`
* `undefined`
* `Boolean` objects (`new Boolean(true)` vs. the primitive `true`)
* `Date` objects
* `RegExp` objects

#### Identity Preservation

In JSON, if an object or array contains multiple references to the same
object, the fact that they are the same object is lost during
serialization.

```javascript
var person = {
  firstName: "Tom",
  lastName: "Dale"
};

var blog = {
  administrator: person,
  author: person
};

blog.administrator === blog.author; // true

var jsonClone = JSON.parse(JSON.stringify((blog));
jsonClone.administrator === jsonClone.author; // false
```

When Kamino.js serializes an object, it includes information about the
identity of objects. If the same object is used multiple times in the
same serialized graph, its identity will be preserved during
deserialization.

```javascript
var kaminoClone = Kamino.clone(blog);
kaminoClone.administrator === kaminoClone.author; // true
```

#### Circular References

Because of the identity support described above, it is no problem at all
to pass an object with circular references:

```javascript
var parent = {};
var child = {};

parent.child = child;
child.parent = parent;

JSON.stringify(parent);
// TypeError: Converting circular structure to JSON

Kamino.stringify(parent);
// OK!
```

### Limitations

#### Structured Algorithm Limitations

Some limitations of Kamino.js are inherent to the structured clone
algorithm itself.

###### Restricted Types

For security reasons, you are not allowed to clone `Error`, `Function`
or `Element` objects. Doing so will raise a `DATA_CLONE_ERR` exception.

###### Imperfect Clones

Property descriptors, getters, and setters are not preserved when
cloning objects, nor is the prototype chain.

```javascript
var Person = function(name) {
  this.name = name;
};
Person.prototype.isPerson = true;

var patrick = new Person("Patrick Gibson");
patrick.name;
// "Patrick Gibson"
patrick.isPerson;
// true

var clone = Kamino.clone(patrick);
clone.name;
// "Patrick Gibson"
clone.isPerson;
// undefined 
```

#### Kamino.js Limitations

Some parts of the structured algorithm specification rely on being able
to manually manage memory in the VM, which is not exposed to JavaScript.
Therefore, you should note these limitations when using Kamino.js.

##### Performance

Because the native browser implementation of the structured clone
algorithm is able to copy the objects from one memory space to another
directly, it will always have a performance benefit over Kamino.js,
which must serialize to an intermediate string format.

For most uses, the performance difference should be negligible. But you
should keep it in mind if transferring extremely large data structures.

##### Transferable Objects

From the W3C specification:

> Some objects support being copied and closed in one operation. This
> is called transferring the object, and is used in particular to
> transfer ownership of unsharable or expensive resources across worker
> boundaries.

Because there is no API for allowing us to neuter objects, or transfer
objects from one memory space to another, this feature is not supported
in Kamino.js and will raise an error.

##### Compatibility

It is important to note that **the Kamino.js serialization format is not
designed to serve as a data interchange.** It is extremely
hardcoded to JavaScript semantics and is not intended to be used in
environments outside of the browser. If you would like to pass messages
across different environments, please use JSON instead!

Kamino.js is designed to be used for immediate serialization and
deserialization across memory boundaries within the same browser
context. **Any other use is at your own risk.**

Additionally, the Kamino.js serialization format, while based on JSON,
has not undergone the same level of scrutiny and standardization. The
serialized output from `Kamino.stringify` is intended to be consumed
*only* by `Kamino.parse`. I am happy to more rigorously specify the
serialization format if there is community interest, but in the
meantime, you should only use Kamino.js to generate and consume the
serialized forms, and until a version 1.0 is released I reserve the
right to make breaking changes to the serialization format.
