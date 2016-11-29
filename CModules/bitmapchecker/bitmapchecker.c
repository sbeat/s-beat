/*
Copyright (c) 2016 S-BEAT GbR and others

This file is part of S-BEAT.

S-BEAT is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

S-BEAT is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with S-BEAT. If not, see <http://www.gnu.org/licenses/>.
*/

#include <Python.h>
#include "structmember.h"
#include <stdio.h>
#include <stdlib.h>

#define BMC_MAX_FEATURE_INT 256

typedef struct {
    PyObject_HEAD
	unsigned int *data; /* length of count*int_size */
	int count; /* maximum count of entries */
	int rows; /* really set rows in data */
	int read_rows;
	int columns; /* count of columns */
	int int_size; /* count of int columns */
	int max_feature_ints;
} BitmapObject;
static PyTypeObject BitmapObjectType;
static PyObject * bitmapchecker_getBitMapTuple(unsigned int *data, int int_size, int columns);

static void bitmapchecker_resetData(unsigned int *data, int int_size) {
	int i;
	for(i=0; i<int_size; i++) {
		data[i]=0;
	}
}

static int bitmapchecker_getIntSize(int bit_size /* columns */) {
	int int_size = bit_size >> 5;
	if(bit_size & 31) {
		int_size++;
	}
	int_size += 2;
	return int_size;
}

static void bitmapchecker_setBit(unsigned int *data, int bit_num) {
	int record = bit_num >> 5;
    int offset = bit_num & 31;
    int mask = 1 << offset;
    record += 2;
    data[record] |= mask;
}
static unsigned int bitmapchecker_testBit(unsigned int *data, int bit_num) {
	int record = bit_num >> 5;
    int offset = bit_num & 31;
    int mask = 1 << offset;
    record += 2;
    return data[record] & mask;
}
static unsigned int bitmapchecker_testBitmap(unsigned int *data, unsigned int *test_bits) {
	int i;
	int int_size = bitmapchecker_getIntSize(test_bits[1]+1);
	for(i=2; i<int_size; i++) {
		if((data[i] & test_bits[i]) != test_bits[i])
			return 0;
	}
	return data[0];    
}
static unsigned int bitmapchecker_testBitmapOne(unsigned int *data, unsigned int *test_bits) {
	int i;
	int int_size = bitmapchecker_getIntSize(test_bits[1]+1);
	for(i=2; i<int_size; i++) {
		if((data[i] & test_bits[i]) == test_bits[i])
			return 1;
	}
	return 0;    
}
static unsigned int bitmapchecker_testBitmapExact(unsigned int *data, unsigned int *test_bits) {
	int int_size = bitmapchecker_getIntSize(test_bits[1]+1);
	if(memcmp(data+2,test_bits+2,(int_size-2)*sizeof(unsigned int))==0) {
		return data[0];
	} else {
		return 0;
	}
	
	/*int i;
	for(i=2; i<int_size; i++) {
		if(test_bits[i] != data[i])
			return 0;
	}
	return data[0];*/
	
}
static void bitmapchecker_updateBitmap(BitmapObject *self, unsigned int *add_bits) {
	int i=0,
		count=0, 
		total_size=self->rows*self->int_size, 
		int_size=self->int_size;

	// look for existing row
	for(i=0; i<total_size; i+=int_size) { // i = start index of data
		count = bitmapchecker_testBitmapExact(self->data+i,add_bits);
		if(count) {
			self->data[i]+=1;
			return;
		}
	}

	// if nothing found
	if(total_size<self->count*int_size) {
		//printf("add bitmap ");
		memcpy(self->data+total_size,add_bits,int_size*sizeof(unsigned int));
		self->data[total_size] = 1;
		//printf(" count: %d",self->data[total_size]);
		self->rows++;
		
	}


}

static PyObject * bitmapchecker_getBitMapTuple(unsigned int *data, int int_size, int columns) {
	PyObject *result = PyTuple_New(2+columns);
	int i;
	PyTuple_SetItem(result,0,PyInt_FromLong(data[0]));
	PyTuple_SetItem(result,1,PyInt_FromLong(data[1]));

	for(i=0; i<columns; i++) {
		if(bitmapchecker_testBit(data,i)) {
			PyTuple_SetItem(result,i+2,PyInt_FromLong(1));
		} else {
			PyTuple_SetItem(result,i+2,PyInt_FromLong(0));
		}
		
	}
	return result;
}

// https://docs.python.org/2/library/pickle.html#pickling-and-unpickling-extension-types
static PyObject * bitmapchecker_reduce(BitmapObject* self) {
	PyObject *result = PyTuple_New(2);  
	PyObject *args = PyTuple_New(5);  // arguments for the callable
	
	int i, total_size = self->rows*self->int_size;
	PyObject *data = PyList_New(total_size);

	printf("bitmapchecker_reduce %d count: %d columns: %d rows: %d int_size: %d\n",self,self->count,self->columns,self->rows,self->int_size);

	for(i=0; i<total_size; i++) {
		PyList_SetItem(data,i,PyInt_FromLong(self->data[i]));
	}

	// set args
	PyTuple_SetItem(args,0,data);
	PyTuple_SetItem(args,1,PyInt_FromLong(self->count));
	PyTuple_SetItem(args,2,PyInt_FromLong(self->columns));
	PyTuple_SetItem(args,3,PyInt_FromLong(self->rows));
	PyTuple_SetItem(args,4,PyInt_FromLong(self->int_size));
	

	PyTuple_SetItem(result,0,(PyObject *)Py_TYPE(self));
	PyTuple_SetItem(result,1,args);

	printf("bitmapchecker_reduce %d reduced count: %d columns: %d rows: %d int_size: %d\n",self,self->count,self->columns,self->rows,self->int_size);
	return result;
}

static PyObject * bitmapchecker_unpickle(BitmapObject* self, PyObject *args, PyObject *kwds) {
	PyObject *data;
	int count, rows, columns, int_size, len, i;
	PyObject* item=NULL;
	PyObject* seq=NULL;

	static char *kwlist[] = {"data","count","columns", "rows", "int_size", NULL};
    if (! PyArg_ParseTupleAndKeywords(args, kwds, "Oiiii", kwlist, 
                                      &count, &rows, 
                                      &columns, &int_size, &data)) {
		Py_RETURN_NONE;
	}

	self = PyObject_New(BitmapObject,&BitmapObjectType);
	self->count = count;
	self->rows = rows;
	self->columns = columns;
	self->int_size = int_size;

	self->data = PyMem_New(unsigned int, self->rows*self->int_size );
	if (self->data == NULL) {
		Py_RETURN_NONE;
	}


	seq = PySequence_Fast(data, "expected a sequence");
	len = PySequence_Size(data);
	for (i = 0; i < len; i++) {
		item = PySequence_Fast_GET_ITEM(seq, i);
		self->data[i] = PyInt_AsLong(item);
		Py_DECREF(item);
	}
	Py_DECREF(seq);

	return (PyObject *)self;
}


static int bitarray_lb_cmp (const void * a, const void * b) {
   return ( ((int*)b)[1] - ((int*)a)[1] );
}

static void
BitmapObject_dealloc(BitmapObject* self)
{
	//printf("BitmapObject_dealloc count: %d columns: %d\n",self->count,self->columns);
	if(self->data!=NULL)
		PyMem_Del(self->data);
    self->ob_type->tp_free((PyObject*)self);
}

static PyObject *
BitmapObject_new(PyTypeObject *type, PyObject *args, PyObject *kwds)
{
    BitmapObject *self;

    self = (BitmapObject *)type->tp_alloc(type, 0);
    if (self != NULL) {
		self->count = 0;
		self->columns = 0;
		self->rows = 0;
		self->int_size = 0;
		self->data = NULL;
		self->max_feature_ints = BMC_MAX_FEATURE_INT;

    }

	//printf("BitmapObject_new\n");

    return (PyObject *)self;
}

static int
BitmapObject_init(BitmapObject *self, PyObject *args, PyObject *kwds)
{
	PyObject *iterator=NULL;
	int i=0, rows=0, int_size=0;
	PyObject* item=NULL;
	PyObject* col_item=NULL;
	PyObject* seq=NULL;
	int len=0;
	int rowindex = 0;
	unsigned int tmp_row[BMC_MAX_FEATURE_INT];
	long intitem;
	int total_size=0;

	static char *kwlist[] = {"iterator","count", "columns", "rows", "int_size", NULL};
    if (! PyArg_ParseTupleAndKeywords(args, kwds, "Oii|ii", kwlist, 
                                      &iterator, &self->count, 
                                      &self->columns, &rows, &int_size))
        return -1;

	//printf("BitmapObject_init count: %d columns: %d rows: %d int_size: %d\n",self->count,self->columns,rows,int_size);
	
	self->int_size = self->columns >> 5;  // number of 32 bit integers
    if(self->columns & 31)  // if bitSize != (32 * n) add
		self->int_size += 1;  // a record for stragglers
	self->int_size += 2;

	total_size = self->count*self->int_size;
	self->data = PyMem_New(unsigned int, total_size );
	if (self->data == NULL) {
		printf("BitmapObject_init alloc error count: %d columns: %d rows: %d int_size: %d\n",self->count,self->columns,rows,int_size);
		return -1;
	}
	
	memset(self->data,0,total_size*sizeof(unsigned int));
	
	// check if must unpickle
	if(PyList_Check(iterator) && rows && int_size) {
		self->int_size = int_size;
		self->rows = rows;

		//printf("BitmapObject_init %d start unpickle count: %d columns: %d rows: %d int_size: %d\n",self,self->count,self->columns,rows,int_size);
		
		seq = PySequence_Fast(iterator, "expected a sequence");
		len = PySequence_Size(iterator);
		for (i = 0; i < len && i < total_size; i++) {
			col_item = PyList_GetItem(seq, i);
			if(col_item==NULL) {
				//Py_DECREF(col_item);
				continue;
			}
			self->data[i] = PyInt_AS_LONG(col_item);
			//Py_DECREF(col_item);
		}
		Py_DECREF(seq);

		Py_DECREF(iterator);

		//printf("BitmapObject_init %d unpickled count: %d columns: %d rows: %d int_size: %d\n",self,self->count,self->columns,rows,int_size);
		return 0;
	}

	
	iterator = PyObject_GetIter(iterator);
	
	if (iterator == NULL) {
		printf("BitmapObject_init iterator is NULL error count: %d columns: %d rows: %d int_size: %d\n",self->count,self->columns,rows,int_size);
		return -1;
	}

	if (self->int_size>self->max_feature_ints) {
		printf("BitmapObject_init tmp_row alloc error max int size is %d count: %d columns: %d rows: %d int_size: %d\n",self->max_feature_ints,self->count,self->columns,rows,int_size);
		return -1;
	}
	
	while (item = PyIter_Next(iterator)) {
		/*if(rowindex>=self->count) {
			Py_DECREF(item);
			break;
		}*/
		
		memset(tmp_row,0,self->int_size*sizeof(unsigned int));

		seq = PySequence_Fast(item, "expected a sequence");
		if(seq == NULL)
			continue;

		len = PySequence_Size(item);
		for (i = 0; i < len; i++) {
			col_item = PySequence_Fast_GET_ITEM(seq, i);
			if(col_item==NULL) 
				continue;
			intitem = PyInt_AS_LONG(col_item);
			if(intitem) {
				bitmapchecker_setBit(tmp_row,i);
				if((int)tmp_row[1]<i) tmp_row[1]=i;
			}
			//Py_DECREF(col_item);
		}
		Py_DECREF(seq);
		bitmapchecker_updateBitmap(self,tmp_row);
		
		Py_DECREF(item);
		rowindex++;
	}

	self->read_rows = rowindex;
	
	qsort(self->data,self->rows,sizeof(unsigned int)*self->int_size,bitarray_lb_cmp);

	Py_DECREF(iterator);

	if (PyErr_Occurred()) {
		printf("BitmapObject_init PyErr_Occurred count: %d columns: %d rows: %d int_size: %d\n",self->count,self->columns,rows,int_size);
		return -1;
	}

    return 0;
} 

static PyMemberDef BitmapObject_members[] = {
    {"count", T_INT, offsetof(BitmapObject, count), 0, "bitmapchecker count"},
	{"rows", T_INT, offsetof(BitmapObject, rows), 0, "bitmapchecker rows"},
	{"read_rows", T_INT, offsetof(BitmapObject, read_rows), 0, "bitmapchecker read_rows"},
	{"columns", T_INT, offsetof(BitmapObject, columns), 0, "bitmapchecker columns"},
	{"int_size", T_INT, offsetof(BitmapObject, int_size), 0, "bitmapchecker int_size"},
    {NULL}  /* Sentinel */
};


static PyObject *
BitmapObject_count_matching(BitmapObject* self, PyObject *args, PyObject *kwds)
{
	PyObject *bit_seq=NULL;
	PyObject* col_item;
	PyObject* seq;
	int i, len;
	unsigned int tmp_row[BMC_MAX_FEATURE_INT];
	long intitem;
	int int_size = self->int_size;
	int total_size = self->rows*int_size;
	int count = 0;

	static char *kwlist[] = {"bit_seq", NULL};
    if (! PyArg_ParseTupleAndKeywords(args, kwds, "O|", kwlist, 
                                      &bit_seq))
		return PyInt_FromLong(0);

	memset(tmp_row,0,self->int_size*sizeof(unsigned int));

	seq = PySequence_Fast(bit_seq, "expected a sequence");
	if(seq == NULL)
		return PyInt_FromLong(0);

	len = PySequence_Size(bit_seq);
	for (i = 0; i < len && i<self->columns; i++) {
		col_item = PySequence_Fast_GET_ITEM(seq, i);
		if(col_item==NULL) 
				continue;
		intitem = PyInt_AS_LONG(col_item);
		if(intitem) {
			bitmapchecker_setBit(tmp_row,i);
			if((int)tmp_row[1]<i) tmp_row[1]=i;
		}
		//Py_DECREF(col_item);
	}
	Py_DECREF(seq);
	
	for (i = 0; i < total_size && tmp_row[1]<=self->data[i+1]; i+=int_size) {
		count += bitmapchecker_testBitmap(self->data+i,tmp_row);
	}

   return PyInt_FromLong(count);
}


static PyObject *
BitmapObject_run_combinations(BitmapObject* self, PyObject *args, PyObject *kwds)
{
	PyObject* set_generator=NULL;
	PyObject* callback;
	PyObject* seq;
	PyObject* iterator=NULL;
	PyObject* item=NULL;
	PyObject* col_item=NULL;
	PyObject* total_counts=NULL;
	PyObject* callb_args;
	long start = 0;
	long index = 0;
	long num = 0;
	long end = -1;
	long len = 0;
	long i = 0;
	long pos = 0;
	long count = 0;
	long denied = 0;
	long rate = 1000;
	unsigned long item_counts[BMC_MAX_FEATURE_INT*32];
	unsigned int tmp_row[BMC_MAX_FEATURE_INT];
	int total_size = self->rows*self->int_size;
	double support = 0.0;
	double min_support = 0.1;

	static char *kwlist[] = {"set_generator","total_counts","callback","start","end","min_spport","rate", NULL};
    if (! PyArg_ParseTupleAndKeywords(args, kwds, "OOO|lldl", kwlist, 
                                      &set_generator,&total_counts,&callback,&start,&end,&min_support,&rate))
		return PyInt_FromLong(0);

	if(!PyCallable_Check(callback)) {
		printf("BitmapObject callback not callable");
		Py_RETURN_FALSE;
	}

	// set all item_counts from total_counts
	memset(item_counts,0,self->columns*sizeof(unsigned long));
	seq = PySequence_Fast(total_counts, "expected a sequence");
	if(seq == NULL) {
		printf("BitmapObject total_counts not iterable");
		Py_RETURN_FALSE;
	}

	len = PySequence_Size(total_counts);
	for (i = 0; i < len; i++) { // run through itemset
		col_item = PySequence_Fast_GET_ITEM(seq, i);
		if(col_item==NULL) 
			continue;
		item_counts[i] = PyInt_AS_LONG(col_item);
	}
	Py_DECREF(seq);


	// run through all combinations
	iterator = PyObject_GetIter(set_generator);
	if (iterator == NULL) {
		printf("BitmapObject set_generator not iterable");
		Py_RETURN_FALSE;
	}
	count = 0;
	// Generator delivers an tuple of element indices
	while (item = PyIter_Next(iterator)) { 
		index++;
		if(index<start) {
			Py_DECREF(item);
			continue;
		}
		if(end!=-1 && index>=end) {
			Py_DECREF(item);
			break;
		}

		seq = PySequence_Fast(item, "expected a sequence");
		if(seq == NULL) {
			Py_DECREF(item);
			continue;
		}

		memset(tmp_row,0,self->int_size*sizeof(unsigned int));
		
		tmp_row[0] = -1;

		len = PySequence_Size(item);
		for (i = 0; i < len; i++) { // run through itemset
			col_item = PySequence_Fast_GET_ITEM(seq, i);
			if(col_item==NULL) 
				continue;
			pos = PyInt_AS_LONG(col_item);
			bitmapchecker_setBit(tmp_row,pos);
			if((int)tmp_row[1]<pos) tmp_row[1]=pos;
			if(tmp_row[0]==-1 || item_counts[pos]<tmp_row[0])
				tmp_row[0] = item_counts[pos];
			
		}
		Py_DECREF(seq);

		count = 0;
		for (i = 0; i < total_size && tmp_row[1]<=self->data[i+1]; i+=self->int_size) {
			count += bitmapchecker_testBitmap(self->data+i,tmp_row);
		}

		support = tmp_row[0]?((double)count/(double)tmp_row[0]):0;
		if(support>min_support) {
			//printf("found set %d/%d %f\n",count,tmp_row[0]);
			callb_args=PyTuple_New(5); // num, denied, itemset, matched, total
			PyTuple_SetItem(callb_args,0,PyLong_FromLong(num));
			PyTuple_SetItem(callb_args,1,PyLong_FromLong(denied));
			PyTuple_SetItem(callb_args,2,item);
			PyTuple_SetItem(callb_args,3,PyLong_FromLong(count));
			PyTuple_SetItem(callb_args,4,PyLong_FromLong(tmp_row[0]));
			PyObject_CallObject(callback,callb_args);
			Py_DECREF(callb_args);
			
		} else {
			denied++;
			
		}

		Py_DECREF(item);

		if(num%rate==0) {
			callb_args=PyTuple_New(5); // num, denied, itemset, matched, total
			PyTuple_SetItem(callb_args,0,PyLong_FromLong(num));
			PyTuple_SetItem(callb_args,1,PyLong_FromLong(denied));
			Py_INCREF(Py_None);
			PyTuple_SetItem(callb_args,2,Py_None);
			Py_INCREF(Py_None);
			PyTuple_SetItem(callb_args,3,Py_None);
			Py_INCREF(Py_None);
			PyTuple_SetItem(callb_args,4,Py_None);
			PyObject_CallObject(callback,callb_args);
			Py_DECREF(callb_args);
			
		}
		
		num++;
	}

	Py_DECREF(iterator);
	
	Py_RETURN_TRUE;
}

static PyObject *
BitmapObject_run_combinations_k(BitmapObject* self, PyObject *args, PyObject *kwds)
{
	PyObject* callback;
	PyObject* seq;
	PyObject* iterator=NULL;
	PyObject* item=NULL;
	PyObject* col_item=NULL;
	PyObject* total_counts=NULL;
	PyObject* required=NULL;
	PyObject* callb_args;
	long long start = 0;
	long long index = 0;
	long long num = 0;
	long long end = -1;
	long len = 0;
	long i = 0;
	long j = 0;
	long pos = 0;
	long count = 0;
	long long denied = 0;
	long rate = 1000;
	unsigned int min_matching = 10;
	long k = 0;
	unsigned long *item_counts;
	unsigned int *indices;
	unsigned int *tmp_row;
	int *required_cols;
	int total_size = self->rows*self->int_size;
	double support = 0.0;
	double min_support = 0.1;
	//FILE* fp = fopen("bitmapchecker.log","w");

	static char *kwlist[] = {"long","total_counts","required","callback","start","end","min_spport","rate","min_matching", NULL};
    if (! PyArg_ParseTupleAndKeywords(args, kwds, "iOOO|LLdlI", kwlist, 
                                      &k,&total_counts,&required,&callback,&start,&end,&min_support,&rate,&min_matching))
		return PyInt_FromLong(0);

	if(!PyCallable_Check(callback)) {
		printf("BitmapObject callback not callable");
		Py_RETURN_FALSE;
	}

	if(k>self->columns) {
		Py_RETURN_FALSE;
	}

	

	item_counts = PyMem_New(unsigned long, self->columns );
	tmp_row = PyMem_New(unsigned int, self->int_size );

	// set all item_counts from total_counts
	memset(item_counts,0,self->columns*sizeof(unsigned long));
	seq = PySequence_Fast(total_counts, "expected a sequence");
	if(seq == NULL) {
		printf("BitmapObject total_counts not iterable");
		PyMem_Del(item_counts);
		PyMem_Del(tmp_row);
		Py_RETURN_FALSE;
	}

	len = PySequence_Size(total_counts);
	for (i = 0; i < len; i++) { // run through itemset
		col_item = PySequence_Fast_GET_ITEM(seq, i);
		if(col_item==NULL) 
			continue;
		item_counts[i] = PyInt_AS_LONG(col_item);
	}
	Py_DECREF(seq);


	// required fields
	required_cols = PyMem_New(int, self->columns );
	memset(required_cols,-1,self->columns*sizeof(int));

	seq = PySequence_Fast(required, "expected a sequence");
	if(seq == NULL) {
		printf("BitmapObject required_oneof not iterable");
		PyMem_Del(item_counts);
		PyMem_Del(tmp_row);
		PyMem_Del(required_cols);
		Py_RETURN_FALSE;
	}
		
	len = PySequence_Size(required);
	for (i = 0; i < len && i<self->columns; i++) {
		col_item = PySequence_Fast_GET_ITEM(seq, i);
		if(col_item==NULL) 
				continue;
		pos = PyInt_AS_LONG(col_item);
		required_cols[i] = pos;
	}
	Py_DECREF(seq);



	indices = PyMem_New(unsigned int, k );
	for(i=0; i<k; i++) {
	    indices[i] = i;
	}

    index = 0;
    count = 0;
	// source: http://svn.python.org/view/python/tags/r271/Modules/itertoolsmodule.c?view=markup
	while(1) {
	    if(index>0) {
			/* Scan indices right-to-left until finding one that is not at its maximum (i + n - r). */
            for (i=k-1 ; i >= 0 && indices[i] == i+self->columns-k ; i--);

			/* If i is negative, then the indices are all at their maximum value and we're done. */
			if(i<0) {
				break;
			}

			/* Increment the current index which we know is not at its
	           maximum.  Then move back to the right setting each index
	           to its lowest possible value (one higher than the index
	           to its left -- this maintains the sort order invariant). */
            indices[i]++;
            for(j=i+1; j<k; j++) {
                indices[j] = indices[j-1] + 1;
            }
	    }

	    index++;
	    if(index<start) {
			continue;
		}
		if(end!=-1 && index>end) {
			break;
		}

	    memset(tmp_row,0,self->int_size*sizeof(unsigned int));

		//printf("indices:");
	    tmp_row[0] = -1;
		j = -1;
	    for(i=0; i<k; i++) {
	        pos = indices[i];
			//printf(" %d",pos);
	        bitmapchecker_setBit(tmp_row,pos);
			if(required_cols[pos]!=-1) j=required_cols[pos];

	        if((int)tmp_row[1]<pos) tmp_row[1]=pos;
			if(tmp_row[0]==-1 || item_counts[pos]<tmp_row[0])
				tmp_row[0] = item_counts[pos];
	    }
		//printf("\n");

		// check for required
		if(j!=-1) {
			for(i=0; i<k; i++) {
				if(indices[i]==j) {
					j=-1;
					break;
				}
			}
		}



		if(k<2 || j==-1) {

			count = 0;
			for (i = 0; i < total_size && tmp_row[1]<=self->data[i+1]; i+=self->int_size) {
				count += bitmapchecker_testBitmap(self->data+i,tmp_row);
			}


			support = tmp_row[0]?((double)count/(double)tmp_row[0]):0;
			if(support>min_support && tmp_row[0]>=min_matching) {
				//fprintf(fp,"callb_found %d %.4f | ",k,support);
				//fflush(fp);
				item = PyTuple_New(k);
				for(j=0; j<k; j++) {
					PyTuple_SetItem(item,j,PyInt_FromLong(indices[j]));
				}
				//fprintf(fp,". ");
				//fflush(fp);

				//printf("found set %d/%d %f\n",count,tmp_row[0]);
				callb_args=PyTuple_New(5); // num, denied, itemset, matched, total
				PyTuple_SetItem(callb_args,0,PyLong_FromLongLong(num));
				PyTuple_SetItem(callb_args,1,PyLong_FromLongLong(denied));
				//fprintf(fp,". ");
				//fflush(fp);
				PyTuple_SetItem(callb_args,2,item);
				PyTuple_SetItem(callb_args,3,PyLong_FromLong(count));
				PyTuple_SetItem(callb_args,4,PyLong_FromLong(tmp_row[0]));
				//fprintf(fp,". ");
				//fflush(fp);
				PyObject_CallObject(callback,callb_args);
				Py_DECREF(callb_args);
				//fprintf(fp,"OK\n");
				//fflush(fp);

			} else {
				denied++;

			}
		} else {
			denied++;
		}

		if(num%rate==0) {
			//fprintf(fp,"callb_status ");
			//fflush(fp);
			callb_args=PyTuple_New(5); // num, denied, itemset, matched, total
			PyTuple_SetItem(callb_args,0,PyLong_FromLongLong(num));
			PyTuple_SetItem(callb_args,1,PyLong_FromLongLong(denied));
			Py_INCREF(Py_None);
			PyTuple_SetItem(callb_args,2,Py_None);
			Py_INCREF(Py_None);
			PyTuple_SetItem(callb_args,3,Py_None);
			Py_INCREF(Py_None);
			PyTuple_SetItem(callb_args,4,Py_None);
			PyObject_CallObject(callback,callb_args);
			Py_DECREF(callb_args);
			//fprintf(fp,"OK\n");
			//fflush(fp);
		}

		num++;

	}

	//fclose(fp);

	PyMem_Del(item_counts);
	PyMem_Del(tmp_row);
	PyMem_Del(indices);
	PyMem_Del(required_cols);

	Py_RETURN_TRUE;
}

static PyObject *
BitmapObject_count_matching_debug(BitmapObject* self, PyObject *args, PyObject *kwds)
{
	PyObject *result;
	PyObject *bit_seq=NULL;
	PyObject* col_item;
	PyObject* seq;
	int i, len;
	unsigned int *tmp_row;
	long intitem;
	int int_size = self->int_size;
	int total_size = self->rows*int_size;
	int count = 0;
	int set_items = 0;
	int res = 0;
	int added = 0;

	static char *kwlist[] = {"bit_seq", NULL};
    if (! PyArg_ParseTupleAndKeywords(args, kwds, "|O", kwlist, 
                                      &bit_seq))
		return PyInt_FromLong(0);

	

	tmp_row = PyMem_New(unsigned int, self->int_size );
	if (tmp_row == NULL)
		return PyErr_NoMemory();

	for (i = 0; i < int_size; i++) {
		tmp_row[i]=0;
	}

	seq = PySequence_Fast(bit_seq, "expected a sequence");
	if (!PyList_Check(seq)) {
		return PyInt_FromLong(0);
	}

	len = PySequence_Size(bit_seq);
	result = PyList_New(0);
	for (i = 0; i < len; i++) {
		col_item = PySequence_Fast_GET_ITEM(seq, i);
		intitem = PyInt_AS_LONG(col_item);
		
		if(intitem) {
			//PyList_Append(result,PyInt_FromLong(i));
			bitmapchecker_setBit(tmp_row,i);
			if((int)tmp_row[1]<i) tmp_row[1]=i;
		}
		Py_DECREF(col_item);

	}
	Py_DECREF(seq);

	PyList_Append(result, bitmapchecker_getBitMapTuple(tmp_row,int_size,self->columns));

	PyList_Append(result, PyString_FromString("matching:"));

	for (i = 0; i < total_size; i+=int_size) {
		res = bitmapchecker_testBitmap(self->data+i,tmp_row);
		if(res) {
			PyList_Append(result, bitmapchecker_getBitMapTuple(self->data+i,int_size,self->columns));
			added++;
		}
		count += res;
	}

	PyMem_Del(tmp_row);

	return result;

	return PyInt_FromLong(count);
}

static PyMethodDef BitmapObject_methods[] = {
	{"count_matching", (PyCFunction)BitmapObject_count_matching, METH_KEYWORDS,"Return number of matched entries"},
	{"count_matching_debug", (PyCFunction)BitmapObject_count_matching_debug, METH_KEYWORDS,"Return number of matched entries debug"},
	{"run_combinations", (PyCFunction)BitmapObject_run_combinations, METH_KEYWORDS,"Runs all combinatins for elements"},
	{"run_combinations_k", (PyCFunction)BitmapObject_run_combinations_k, METH_KEYWORDS,"Runs all combinatins for elements"},
	{"__reduce__", (PyCFunction)bitmapchecker_reduce, METH_NOARGS,"data for Pickle"},
//	{"unpickle", (PyCFunction)bitmapchecker_unpickle, METH_STATIC|METH_NOARGS,"Unpickels object"},
    {NULL}  /* Sentinel */
};

static PyTypeObject BitmapObjectType = {
    PyObject_HEAD_INIT(NULL)
    0,                         /*ob_size*/
    "bitmapchecker.BitmapObject",             /*tp_name*/
    sizeof(BitmapObject),             /*tp_basicsize*/
    0,                         /*tp_itemsize*/
    (destructor)BitmapObject_dealloc, /*tp_dealloc*/
    0,                         /*tp_print*/
    0,                         /*tp_getattr*/
    0,                         /*tp_setattr*/
    0,                         /*tp_compare*/
    0,                         /*tp_repr*/
    0,                         /*tp_as_number*/
    0,                         /*tp_as_sequence*/
    0,                         /*tp_as_mapping*/
    0,                         /*tp_hash */
    0,                         /*tp_call*/
    0,                         /*tp_str*/
    0,                         /*tp_getattro*/
    0,                         /*tp_setattro*/
    0,                         /*tp_as_buffer*/
    Py_TPFLAGS_DEFAULT | Py_TPFLAGS_BASETYPE, /*tp_flags*/
    "BitmapObject objects",           /* tp_doc */
    0,		               /* tp_traverse */
    0,		               /* tp_clear */
    0,		               /* tp_richcompare */
    0,		               /* tp_weaklistoffset */
    0,		               /* tp_iter */
    0,		               /* tp_iternext */
    BitmapObject_methods,             /* tp_methods */
    BitmapObject_members,             /* tp_members */
    0,                         /* tp_getset */
    0,                         /* tp_base */
    0,                         /* tp_dict */
    0,                         /* tp_descr_get */
    0,                         /* tp_descr_set */
    0,                         /* tp_dictoffset */
    (initproc)BitmapObject_init,      /* tp_init */
    0,                         /* tp_alloc */
    BitmapObject_new,                 /* tp_new */
};

static PyMethodDef module_methods[] = {
//	{"unpickle", (PyCFunction)bitmapchecker_unpickle, METH_NOARGS,"Unpickels object"},
    {NULL}  /* Sentinel */
};

#ifndef PyMODINIT_FUNC	/* declarations for DLL import/export */
#define PyMODINIT_FUNC void
#endif
PyMODINIT_FUNC
initbitmapchecker(void) 
{
    PyObject* m;

    if (PyType_Ready(&BitmapObjectType) < 0)
        return;

    m = Py_InitModule3("bitmapchecker", module_methods,
                       "Example module that creates an extension type.");

    if (m == NULL)
      return;

    Py_INCREF(&BitmapObjectType);
    PyModule_AddObject(m, "BitmapObject", (PyObject *)&BitmapObjectType);
	
}