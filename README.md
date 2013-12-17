jsonhib
=======

A way to read/write JSON in a MySQL database.  jsonhib is available for both Node.js and PHP.

Here's a simple jsonhib object:

```
// create a jsonhib object
var jh = new jsonhib({
   'link_identifier': conn,
   'sort_column': 'n', // array index column name
   'json_column': 'json' // freeform JSON column name
});
```

Or, in PHP:

```
// create a jsonhib object
$jh = new jsonhib(array(
  'sort_column'=>'n',
  'json_column'=>'json'
));
```

Here's an example of reading a table:

```
// assume 'mytable' is a MySQL table with these columns: id, name
jh.readRows('mytable', 'WHERE id > 0', function(s) {
  var str = s;
});
// str now contains [{"id": 1, "name": "bob"}, {"id": 2, "name": "fred"}]
jh.readDesc('mytable', function(s) {
  var str = s;
});
// str now contains {"id": 0, "name": ""}
```

In PHP:

```
// assume 'mytable' is a MySQL table with these columns: id, name
$str = $jh->readRows('mytable', 'WHERE id > 0');
// $str now contains [{"id": 1, "name": "bob"}, {"id": 2, "name": "fred"}]
$str = $jh->readDesc('mytable');
// $str now contains {"id": 0, "name": ""}
```

Here's an example of writing a table:

```
// insert a row
jh.insertRow('mytable', '', -1, '{"id": 1, "name": "bob"}', function() {
});
// delete a row
jh.deleteRow('mytable', '', 0, function() {
});
// update a row
jh.updateRow('mytable', 'WHERE id=1', 0, '{"id": 1, "name": "eric"}', function() {
});
// move a row (huh?)
jh.moveRow('mytable', 'WHERE id=1', 0, 1, function() {
});
```

In PHP:

```
// insert a row
$jh->insertRow('mytable', '', -1, '{"id": 1, "name": "bob"}');
// delete a row
$jh->deleteRow('mytable', '', 0);
// update a row
$jh->updateRow('mytable', 'WHERE id=1', 0, '{"id": 1, "name": "eric"}');
// move a row (huh?)
$jh->moveRow('mytable', 'WHERE id=1', 0, 1);
```

If you can add or alter ```mytable``` to have a ```json_column``` (e.g. ```json```), then any JSON data that doesn't fit into a
MySQL column will be stored in that column.  So, jsonhib will store the ```age``` in the ```json_column``` since ```mytable``` does
not have a MySQL ```age``` column:

```
jh.insertRow('mytable', '', -1, '{"id": 1, "name": "bob", "age": 35}', function() {
});
```

In PHP:

```
$jh->insertRow('mytable', '', -1, '{"id": 1, "name": "bob", "age": 35}');
```

If you can add or alter ```mytable``` to have a ```sort_column``` (e.g. ```n```), then reading and writing JSON array values won't
be in random order; it will use that column to save indices for your JSON array.  jsonhib will quietly use this column
to save values from 0 ... n-1 to keep array indices for your JSON array.  With that, ```readRows()```, ```insertRow()```, ```deleteRow()```, ```updateRow()``` and ```moveRow()``` will work exactly as expected.
