jsonhib
=======

A way to read/write JSON in a MySQL database.  Right now, it is just PHP but it should be easy to translate into Node.js.

Here's a simple jsonhib object:

```
// create a jsonhib object
$jshib = new JSONHIB_obj(array(
  'sort_column'=>'n',
  'json_column'=>'json'
));
```

Here's an example of reading a table:

```
// assume 'mytable' is a MySQL table with these columns: id, name
$str = $jshib->readRows('mytable', 'WHERE id > 0');
// $str now contains [{"id": 1, "name": "bob"}, {"id": 2, "name": "fred"}]
$str = $jshib->readDesc('mytable');
// $str now contains {"id": 0, "name": ""}
```

Here's an example of writing a table:

```
// insert a row
$jshib->insertRow('mytable', '', -1, '{"id": 1, "name": "bob"}');
// delete a row
$jshib->deleteRow('mytable', '', 0);
// update a row
$jshib->updateRow('mytable', 'WHERE id=1', 0, '{"id": 1, "name": "eric"}');
// move a row (huh?)
$jshib->moveRow('mytable', 'WHERE id=1', 0, 1);
```

If you can add or alter ```mytable``` to have a ```json_column``` (e.g. ```json```), then any JSON data that doesn't fit into a
MySQL column will be stored in that column.  So, jsonhib will store the ```age``` in the ```json_column``` since ```mytable``` does
not have a MySQL ```age``` column:

```
$jshib->insertRow('mytable', '', -1, '{"id": 1, "name": "bob", "age": 35}');
```

If you can add or alter ```mytable``` to have a ```sort_column``` (e.g. ```n```), then reading and writing JSON array values won't
be in random order; it will use that column to save indices for your JSON array.  jsonhib will quietly use this column
to save values from 0 ... n-1 to keep array indices for your JSON array.  With that, ```readRows()```, ```insertRow()```, ```deleteRow()```, ```updateRow()``` and ```moveRow()``` will work exactly as expected.
