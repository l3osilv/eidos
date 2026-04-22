## Domande per eseguire il progetto SSL-BrainCT-Patology

1) Posso cambiare le dipendenze dei pacchetti python, o uso la versione la python 3.10?
 ---
2) per eseguire `/stage1_3d_volumetric/supervised_finetuning/scripts/train.py` c'è bisogno che esista la cartella `/data/slices` nella root e come deve essere costituita?

    ```
   python scripts/train.py \                                                                                              
                   --data_dir ../../data/slices \
                   --epochs 150 \
                   --batch_size 2 \
                   --save_dir ../../checkpoints
   ```
   il mio output:
   ``` 
    ======================================================================
    STABLE MAE TRAINING
    ======================================================================
    Configuration:
      Learning rate: 0.0001 (REDUCED for stability)
      Batch size: 2 (minimum 2 required)
      Epochs: 150
      Masking ratio: 0.7
    ======================================================================
    Device: cpu
    
    Loading data from: ../../data/slices
    Traceback (most recent call last):
      File "/home/leonardo/Documents/SSL-BrainCT-Pathology/stage1_3d_volumetric/ssl_pretraining/scripts/train.py", line 215, in <module>
        train(args)
      File "/home/leonardo/Documents/SSL-BrainCT-Pathology/stage1_3d_volumetric/ssl_pretraining/scripts/train.py", line 28, in train
        train_loader = create_ssl_dataloader(
      File "/home/leonardo/Documents/SSL-BrainCT-Pathology/stage1_3d_volumetric/ssl_pretraining/src/ssl_dataloader.py", line 76, in create_ssl_dataloader
        for f in os.listdir(data_dir):
    FileNotFoundError: [Errno 2] No such file or directory: '../../data/slices'
   ```
   
---
3) nel file `/stage1_3d_volumetric/supervised_finetuning/src/dataset.py` alla linea 30 `from src.preprocessing import BrainCTPreprocessor` 
   viene importato BrainCTPreprocessor, ma il file `preprocessing.py` non esiste nella cartella `/stage1_3d_volumetric/supervised_finetuning/src`
 ---
4) per eseguire `/stage2_2d_slice_level/ssl_pretraining/scripts/train_ssl.py` c'è bisogno che esista la cartella `/data/slices` nella root e come deve essere popolata?
```
» python scripts/train_ssl.py \                      
           --ssl_method simclr \
           --encoder densenet121 \
           --epochs 40 \
           --batch_size 128
```
il mio output:
```
======================================================================
SSL PRETRAINING CONFIGURATION
======================================================================

Experiment
  Run name: ssl_simclr_densenet121
  SSL Method: SIMCLR
  Encoder: densenet121

Data
  Original data: ../../../data/slices
  Public datasets: 0 configured
  Image size: (224, 224)

Medical Preprocessing
  Circle mask: False (r=0.45)
  CLAHE: True
  Multi-window CT: True

Training
  Epochs: 40
  Batch size: 128
  Learning rate: 0.0001
  Optimizer: adamw

Output
  Output: outputs/ssl_simclr_densenet121
======================================================================

model.safetensors: 100%|████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 32.3M/32.3M [00:06<00:00, 5.15MB/s]
Traceback (most recent call last):
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/ssl_pretraining/scripts/train_ssl.py", line 147, in <module>
    main()
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/ssl_pretraining/scripts/train_ssl.py", line 71, in main
    model = SimCLR(encoder, temperature=cfg.SIMCLR_TEMPERATURE)
TypeError: SimCLR.__init__() got an unexpected keyword argument 'temperature'
```

---
5) per eseguire `/stage2_2d_slice_level/supervised_finetuning/scripts/train.py` c'è bisogno che esista un file `/data/labels.csv`, come deve essere composto?

```
» python scripts/train.py \                                                                                          
         --run_name exp_blood_binary \
         --task_mode binary \
         --target_class Blood \
         --encoder densenet121 \
         --ssl_weights ../../checkpoints/simclr_densenet121_best.pth
```
il mio output:

```
Task mode set to: binary
Classes: ['Blood']
Num classes: 1
Run name: exp_blood_binary
Output dir: /home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/supervised_finetuning/../../outputs/exp_blood_binary
Task mode set to: binary
Classes: ['Blood']
Num classes: 1
Config saved to /home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/supervised_finetuning/../../outputs/exp_blood_binary/config.json
============================================================
EXPERIMENT: exp_blood_binary
============================================================
Task Mode: binary
Classes: ['Blood']
Encoder: densenet121
Device: cpu
Output: /home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/supervised_finetuning/../../outputs/exp_blood_binary

Loading data...
Traceback (most recent call last):
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/supervised_finetuning/scripts/train.py", line 658, in <module>
    main()
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/supervised_finetuning/scripts/train.py", line 553, in main
    data_list = create_data_list(cfg)
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/supervised_finetuning/src/dataset.py", line 100, in create_data_list
    labels_df = pd.read_csv(cfg.LABELS_PATH)
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/.venv/lib64/python3.10/site-packages/pandas/io/parsers/readers.py", line 912, in read_csv
    return _read(filepath_or_buffer, kwds)
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/.venv/lib64/python3.10/site-packages/pandas/io/parsers/readers.py", line 577, in _read
    parser = TextFileReader(filepath_or_buffer, **kwds)
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/.venv/lib64/python3.10/site-packages/pandas/io/parsers/readers.py", line 1407, in __init__
    self._engine = self._make_engine(f, self.engine)
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/.venv/lib64/python3.10/site-packages/pandas/io/parsers/readers.py", line 1661, in _make_engine
    self.handles = get_handle(
  File "/home/leonardo/Documents/SSL-BrainCT-Pathology/.venv/lib64/python3.10/site-packages/pandas/io/common.py", line 859, in get_handle
    handle = open(
FileNotFoundError: [Errno 2] No such file or directory: '/home/leonardo/Documents/SSL-BrainCT-Pathology/stage2_2d_slice_level/supervised_finetuning/../../data/labels.csv' 
```